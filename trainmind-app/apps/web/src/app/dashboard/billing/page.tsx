'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import {
  Check,
  Zap,
  Crown,
  CreditCard,
  Loader2,
  AlertCircle,
  Star,
  Users,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Subscription {
  tier: string;
  status: string;
  endsAt: string | null;
  hasStripeCustomer: boolean;
}

// ---------------------------------------------------------------------------
// Tier definitions (source of truth for UI)
// ---------------------------------------------------------------------------

interface TierDef {
  id: string;
  name: string;
  price: number;
  icon: typeof Zap;
  featureKeys: string[];
  highlighted?: boolean;
}

const TIER_DEFS: TierDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 14,
    icon: Zap,
    featureKeys: [
      'feature1Team',
      'featureBasicReports',
      'featureWellness',
      'featureCalendar',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 21,
    icon: Star,
    highlighted: true,
    featureKeys: [
      'feature3Teams',
      'featureAdvancedReports',
      'featureAICoach',
      'featurePeriodization',
      'featureRTP',
      'featureAnalytics',
    ],
  },
  {
    id: 'ultra',
    name: 'Ultra',
    price: 45,
    icon: Crown,
    featureKeys: [
      'featureUnlimitedTeams',
      'featureAllProfessional',
      'featureApiAccess',
      'featurePrioritySupport',
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_ORDER: Record<string, number> = { starter: 1, professional: 2, ultra: 3 };

function tierRank(tier: string): number {
  return TIER_ORDER[tier] ?? -1;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const STATUS_KEYS: Record<string, string> = {
  active: 'statusActive',
  trialing: 'statusTrial',
  past_due: 'statusPastDue',
  canceled: 'statusCancelled',
  incomplete: 'statusIncomplete',
};

function statusColor(status: string): string {
  if (status === 'active' || status === 'trialing') return 'bg-emerald-100 text-emerald-700';
  if (status === 'past_due') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const t = useTranslations('billing');
  const locale = useLocale();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // ---- Fetch current subscription ----------------------------------------

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ data: { subscription: Subscription } }>('/billing/subscription');
      setSubscription(res.data.subscription);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('loadError');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // ---- Checkout -----------------------------------------------------------

  const handleCheckout = async (tier: string) => {
    try {
      setCheckoutLoading(tier);
      const res = await apiFetch<{ data: { url: string } }>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ tier }),
      });
      window.location.href = res.data.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('checkoutError');
      setError(message);
      setCheckoutLoading(null);
    }
  };

  // ---- Customer portal ----------------------------------------------------

  const handlePortal = async () => {
    try {
      setPortalLoading(true);
      const res = await apiFetch<{ data: { url: string } }>('/billing/portal', {
        method: 'POST',
      });
      window.location.href = res.data.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('portalError');
      setError(message);
      setPortalLoading(false);
    }
  };

  // ---- Derived state ------------------------------------------------------

  const currentTier = subscription?.tier ?? 'free';
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';

  // ---- Render -------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            &times;
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">{t('loading')}</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Current subscription status card */}
          <div className="card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50">
                  <CreditCard className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {t('plan')} {currentTier === 'free' ? t('free') : TIER_DEFS.find((td) => td.id === currentTier)?.name ?? currentTier}
                  </h2>
                  <div className="mt-1 flex items-center gap-3">
                    {subscription ? (
                      <>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(subscription.status)}`}
                        >
                          {t(STATUS_KEYS[subscription.status] || subscription.status)}
                        </span>
                        {subscription.endsAt && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {t('expiresOn', { date: formatDate(subscription.endsAt, locale) })}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                        {t('noSubscription')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchSubscription}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                {isActive && subscription?.hasStripeCustomer && (
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
                  >
                    {portalLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    {t('manageSubscription')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Pricing tier cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TIER_DEFS.map((tier) => {
              const isCurrent = currentTier === tier.id;
              const isUpgrade = tierRank(tier.id) > tierRank(currentTier);
              const isDowngrade = tierRank(tier.id) < tierRank(currentTier);
              const Icon = tier.icon;

              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col rounded-lg border-2 p-6 transition-shadow ${
                    tier.highlighted
                      ? 'border-teal-500 shadow-lg shadow-teal-100'
                      : isCurrent
                        ? 'border-teal-300 bg-teal-50/30'
                        : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {/* Recommended badge */}
                  {tier.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">
                        Consigliato
                      </span>
                    </div>
                  )}

                  {/* Current badge */}
                  {isCurrent && (
                    <div className="absolute -top-3 right-4">
                      <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                        Piano Attuale
                      </span>
                    </div>
                  )}

                  {/* Icon + name */}
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        tier.highlighted ? 'bg-teal-100' : 'bg-slate-100 dark:bg-slate-700'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${tier.highlighted ? 'text-teal-600' : 'text-slate-600 dark:text-slate-400'}`}
                      />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{tier.name}</h3>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white">&euro;{tier.price}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">/mese</span>
                  </div>

                  {/* Feature list */}
                  <ul className="mb-8 flex-1 space-y-3">
                    {tier.featureKeys.map((key) => (
                      <li key={key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <Check
                          className={`h-4 w-4 shrink-0 ${
                            tier.highlighted ? 'text-teal-600' : 'text-emerald-500'
                          }`}
                        />
                        {t(key)}
                      </li>
                    ))}
                  </ul>

                  {/* CTA button */}
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full rounded-lg border border-teal-300 bg-teal-50 py-2.5 text-sm font-semibold text-teal-700"
                    >
                      Piano Attuale
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckout(tier.id)}
                      disabled={checkoutLoading === tier.id}
                      className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                        tier.highlighted
                          ? 'bg-teal-700 text-white hover:bg-teal-800'
                          : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-400 hover:text-teal-700'
                      }`}
                    >
                      {checkoutLoading === tier.id ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : isUpgrade ? (
                        'Upgrade'
                      ) : isDowngrade ? (
                        'Downgrade'
                      ) : (
                        'Scegli Piano'
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Free tier info when no subscription */}
          {!isActive && (
            <div className="card border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-200">
                  <Users className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Piano Gratuito</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Stai utilizzando il piano gratuito con funzionalit&agrave; limitate.
                    Scegli un piano a pagamento per sbloccare tutte le funzionalit&agrave; di TrainMind AI.
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Check className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      2 atleti
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Check className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      1 utente
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Check className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      Report limitati
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
