'use client';

/**
 * Abbonamento — piano, prova gratuita, uso, scelta del piano ed estensioni.
 *
 * Tutti i numeri arrivano da `GET /billing/entitlements` (apps/api/src/lib/
 * plans.ts): qui non c'e' un listino scritto a mano, cosi' prezzi e limiti
 * non possono divergere fra pagina e regole.
 *
 * Scegliere un piano o un'estensione:
 *  - con Stripe collegato si apre il pagamento;
 *  - senza Stripe il piano viene assegnato subito, come in registrazione.
 * Lo decide l'API, non questa pagina.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  Users,
  Layers,
  UserPlus,
  Sparkles,
  RotateCcw,
  ExternalLink,
  Minus,
  Plus,
  Crown,
} from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { useAuth } from '@/hooks/use-auth';
import { usePlan, type BillingCycle, type CatalogPlan, type PlanTier } from '@/lib/plan/context';

const PLAN_NAMES: Record<PlanTier, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ULTRA: 'Ultra',
  CLUB: 'Club',
};

interface SeatUsage {
  included: number;
  extra: number;
  total: number;
  used: number;
}

function euro(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function Meter({ label, used, limit, icon: Icon }: { label: string; used: number; limit: number; icon: typeof Users }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-teal-500';
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-xl font-bold text-slate-900 dark:text-white">
        {used}
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400"> / {limit}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Stepper({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600">
      <button
        type="button"
        aria-label="-"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="px-2.5 py-1.5 text-slate-600 disabled:opacity-40 dark:text-slate-300"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{value}</span>
      <button
        type="button"
        aria-label="+"
        disabled={disabled || value >= 50}
        onClick={() => onChange(Math.min(50, value + 1))}
        className="px-2.5 py-1.5 text-slate-600 disabled:opacity-40 dark:text-slate-300"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function BillingPage() {
  const t = useTranslations('billing');
  const apiError = useApiError();
  const locale = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { plan, loading, refresh } = usePlan();

  const [offer, setOffer] = useState<'INDIVIDUAL' | 'CLUB'>('INDIVIDUAL');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [seats, setSeats] = useState<SeatUsage | null>(null);

  const [extraTeams, setExtraTeams] = useState(0);
  const [extraSeats, setExtraSeats] = useState(0);
  const [packs, setPacks] = useState<Record<string, number>>({});

  // Allinea i controlli allo stato letto dall'API (e dopo ogni refresh).
  useEffect(() => {
    if (!plan) return;
    const wantsClub = plan.tier === 'CLUB' && plan.mode === 'active' ? true : plan.intendedTier === 'CLUB';
    setOffer(wantsClub ? 'CLUB' : 'INDIVIDUAL');
    setCycle(plan.billingCycle ?? 'monthly');
    setExtraTeams(plan.extensions.extraTeams);
    setExtraSeats(plan.extensions.extraSeats);
    setPacks(Object.fromEntries(plan.usage.perTeam.map((tm) => [tm.id, tm.extraAthletePacks])));
  }, [plan]);

  // Arrivando da un avviso di limite (/dashboard/billing#estensioni) si
  // scende alle estensioni appena la pagina e' disegnata.
  const pronto = !!plan;
  useEffect(() => {
    if (!pronto || typeof window === 'undefined' || window.location.hash !== '#estensioni') return;
    const id = window.setTimeout(() => {
      document.getElementById('estensioni')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    return () => window.clearTimeout(id);
  }, [pronto]);

  useEffect(() => {
    apiFetch<{ data: { seats: SeatUsage } }>('/billing/seats')
      .then((res) => setSeats(res.data.seats))
      .catch(() => setSeats(null));
  }, [plan]);

  const plans = useMemo(
    () => (plan?.catalog.plans ?? []).filter((p) => p.offer === offer),
    [plan, offer],
  );

  const isCurrent = (tier: PlanTier) =>
    !!plan && (plan.mode === 'active' || plan.mode === 'legacy') && plan.tier === tier;

  const activate = async (tier: PlanTier) => {
    setError(null);
    setNotice(null);
    setBusy(tier);
    try {
      const res = await apiFetch<{ data: { url: string | null; activated: boolean } }>('/billing/activate', {
        method: 'POST',
        body: JSON.stringify({ tier: tier.toLowerCase(), cycle }),
      });
      if (res.data.url) {
        window.location.href = res.data.url;
        return;
      }
      setNotice(t('activated', { plan: PLAN_NAMES[tier] }));
      await refresh();
    } catch (err) {
      setError(apiError(err, t('checkoutError')));
    } finally {
      setBusy(null);
    }
  };

  const saveExtensions = async () => {
    if (!plan) return;
    setError(null);
    setNotice(null);
    setBusy('extensions');
    try {
      const res = await apiFetch<{ data: { url: string | null; applied: boolean } }>('/billing/extensions', {
        method: 'POST',
        body: JSON.stringify({
          extraTeams,
          extraSeats,
          teamPacks: Object.entries(packs).map(([teamId, n]) => ({ teamId, packs: n })),
          cycle,
        }),
      });
      if (res.data.url) {
        window.location.href = res.data.url;
        return;
      }
      setNotice(t('extensionsSaved'));
      await refresh();
    } catch (err) {
      setError(apiError(err, t('checkoutError')));
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy('portal');
    try {
      const res = await apiFetch<{ data: { url: string } }>('/billing/portal', { method: 'POST' });
      window.location.href = res.data.url;
    } catch (err) {
      setError(apiError(err, t('portalError')));
      setBusy(null);
    }
  };

  const features = (p: CatalogPlan): string[] => {
    const list = [
      t('feat.teams', { teams: p.teams, athletes: p.athletesPerTeam }),
      t('feat.users', { n: p.seats }),
      p.features.dailyReport ? t('feat.reportsAdvanced') : t('feat.reportsBase'),
      t('feat.wellnessCalendar'),
    ];
    if (p.features.ai) list.push(t('feat.ai', { credits: p.aiCredits }));
    if (p.features.analytics) list.push(t('feat.analytics'));
    if (p.extensions) list.push(t('feat.extensions'));
    return list;
  };

  if (loading && !plan) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">{t('loading')}</span>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t('loadError')}
        </div>
      </div>
    );
  }

  const ext = plan.catalog.extensions;
  const extMonthly =
    extraTeams * ext.team.monthly +
    extraSeats * ext.seat.monthly +
    Object.values(packs).reduce((n, v) => n + v, 0) * ext.athletePack.monthly;
  const statusLabel =
    plan.mode === 'trial'
      ? t('statusTrialDays', { days: plan.trialDaysLeft ?? 0 })
      : plan.mode === 'expired'
        ? t('statusTrialExpired')
        : plan.mode === 'legacy'
          ? t('statusLegacy')
          : t('statusActive');
  const statusTone =
    plan.mode === 'expired'
      ? 'bg-amber-100 text-amber-800'
      : plan.mode === 'trial'
        ? 'bg-teal-100 text-teal-800'
        : 'bg-emerald-100 text-emerald-700';
  const currentName =
    plan.mode === 'trial' || plan.mode === 'expired' ? t('trialName') : PLAN_NAMES[plan.tier];
  const showUsage = plan.enforced;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* ─── Piano attuale ─────────────────────────────── */}
      <div className="card dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/40">
              {plan.mode === 'expired' ? (
                <Lock className="h-6 w-6 text-amber-600" />
              ) : plan.mode === 'trial' ? (
                <Clock className="h-6 w-6 text-teal-600" />
              ) : (
                <Crown className="h-6 w-6 text-teal-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('plan')} {currentName}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone}`}>
                  {statusLabel}
                </span>
                {plan.billingCycle && plan.mode === 'active' && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {plan.billingCycle === 'yearly' ? t('cycleYearly') : t('cycleMonthly')}
                  </span>
                )}
              </div>
              {plan.mode === 'expired' && (
                <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">{t('expiredHelp')}</p>
              )}
              {plan.mode === 'legacy' && (
                <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">{t('legacyHelp')}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void refresh()}
              title={t('refresh')}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            {plan.stripeConfigured && isAdmin && (
              <button
                onClick={openPortal}
                disabled={busy === 'portal'}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
              >
                {busy === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                {t('manageSubscription')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Uso ───────────────────────────────────────── */}
      {showUsage && (
        <div className="card dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t('usageTitle')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Meter icon={Layers} label={t('usageTeams')} used={plan.usage.teams} limit={plan.limits.teams} />
            <Meter icon={Users} label={t('usageAthletes')} used={plan.usage.athletesActive} limit={plan.usage.athleteCapacity} />
            {seats && <Meter icon={UserPlus} label={t('usageUsers')} used={seats.used} limit={seats.total} />}
            <Meter icon={Sparkles} label={t('usageAi')} used={plan.usage.aiCreditsUsed} limit={plan.limits.aiCredits} />
          </div>
          {plan.usage.perTeam.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-700">
              {plan.usage.perTeam.map((tm) => (
                <li key={tm.id} className="flex items-center justify-between py-2">
                  <span className="text-slate-700 dark:text-slate-300">{tm.name}</span>
                  <span className={`tabular-nums ${tm.athletes >= tm.capacity ? 'font-semibold text-amber-600' : 'text-slate-500 dark:text-slate-400'}`}>
                    {t('teamAthletes', { n: tm.athletes, cap: tm.capacity })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {t('usageFootnote', {
              used: plan.usage.reactivationsThisMonth,
              limit: plan.usage.reactivationsLimit,
            })}
          </p>
        </div>
      )}

      {/* ─── Scelta del piano ──────────────────────────── */}
      <div className="card dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('choosePlan')}</h2>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700" role="tablist">
              {(['INDIVIDUAL', 'CLUB'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  role="tab"
                  aria-selected={offer === o}
                  onClick={() => setOffer(o)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${offer === o ? 'bg-teal-700 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  {o === 'INDIVIDUAL' ? t('offerIndividual') : t('offerClub')}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700" role="tablist">
              {(['monthly', 'yearly'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={cycle === c}
                  onClick={() => setCycle(c)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${cycle === c ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  {c === 'monthly' ? t('cycleMonthly') : t('cycleYearlySave')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          {offer === 'INDIVIDUAL' ? t('offerIndividualDesc') : t('offerClubDesc')}
        </p>

        <div className={`grid grid-cols-1 gap-5 ${plans.length > 1 ? 'md:grid-cols-3' : 'md:max-w-md'}`}>
          {plans.map((p) => {
            const recommended = p.tier === 'ULTRA' || p.tier === 'CLUB';
            const current = isCurrent(p.tier);
            const price = cycle === 'monthly' ? p.price.monthly : p.price.yearly;
            return (
              <div
                key={p.tier}
                className={`relative flex flex-col rounded-lg border-2 p-5 ${
                  recommended ? 'border-teal-500 shadow-lg shadow-teal-100 dark:shadow-none' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {recommended && p.tier === 'ULTRA' && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">
                    {t('recommended')}
                  </span>
                )}
                {current && (
                  <span className="absolute -top-3 right-4 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                    {t('currentPlan')}
                  </span>
                )}
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{PLAN_NAMES[p.tier]}</h3>
                <div className="mb-4 mt-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{euro(price, locale)}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {cycle === 'monthly' ? t('perMonth') : t('perYear')}
                  </span>
                </div>
                <ul className="mb-6 flex-1 space-y-2.5">
                  {features(p).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <button disabled className="w-full rounded-lg border border-teal-300 bg-teal-50 py-2.5 text-sm font-semibold text-teal-700">
                    {t('currentPlan')}
                  </button>
                ) : (
                  <button
                    onClick={() => void activate(p.tier)}
                    disabled={!isAdmin || busy !== null}
                    title={!isAdmin ? t('adminOnly') : undefined}
                    className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      recommended
                        ? 'bg-teal-700 text-white hover:bg-teal-800'
                        : 'border border-slate-300 bg-white text-slate-700 hover:border-teal-400 hover:text-teal-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {busy === p.tier ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t('choose')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          {t('vatIncluded')} {!isAdmin && t('adminOnly')}
        </p>
      </div>

      {/* ─── Estensioni (Ultra e Club) ─────────────────── */}
      {plan.extensionsAllowed && plan.mode === 'active' && (
        <div id="estensioni" className="card scroll-mt-20 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('extensionsTitle')}</h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{t('extensionsDesc')}</p>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{t('extTeams')}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('extTeamsPrice', { monthly: ext.team.monthly, yearly: ext.team.yearly, credits: ext.team.aiCredits })}
                </div>
              </div>
              <Stepper value={extraTeams} onChange={setExtraTeams} disabled={!isAdmin} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{t('extUsers')}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('extUsersPrice', { monthly: ext.seat.monthly, yearly: ext.seat.yearly })}
                </div>
              </div>
              <Stepper value={extraSeats} onChange={setExtraSeats} disabled={!isAdmin} />
            </div>
            {plan.usage.perTeam.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{t('extPacks')}</div>
                <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  {t('extPacksPrice', { size: ext.athletePack.size, monthly: ext.athletePack.monthly, yearly: ext.athletePack.yearly })}
                </div>
                <ul className="space-y-2">
                  {plan.usage.perTeam.map((tm) => (
                    <li key={tm.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{tm.name}</span>
                      <Stepper
                        value={packs[tm.id] ?? 0}
                        onChange={(n) => setPacks((prev) => ({ ...prev, [tm.id]: n }))}
                        disabled={!isAdmin}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {t('extTotal', { total: euro(extMonthly, locale) })}
            </span>
            <button
              onClick={() => void saveExtensions()}
              disabled={!isAdmin || busy !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
            >
              {busy === 'extensions' && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('extSave')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
