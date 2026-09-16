'use client';

/**
 * Staff dell'organizzazione: chi c'e', chi e' stato invitato, quanti posti
 * restano.
 *
 * E' l'unico punto da cui si entra in un'organizzazione gia' esistente. La
 * registrazione normale ne crea sempre una nuova, quindi due societa' che si
 * chiamano allo stesso modo restano due societa' distinte: il calendario si
 * condivide solo con chi e' stato invitato da qui.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, UserPlus, X, Mail, Clock, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch, ApiError } from '@/lib/auth/fetch';
import { useAuth } from '@/hooks/use-auth';
import { tierToPlanKey } from '@/components/brand/plan';

type StaffRole = 'ADMIN' | 'TRAINER' | 'MEDICAL' | 'VIEWER';

interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface Invite {
  id: string;
  email: string;
  role: StaffRole;
  expiresAt: string;
}

interface Seats {
  included: number;
  extra: number;
  total: number;
  members: number;
  pendingInvites: number;
  used: number;
  available: number;
}

interface StaffResponse {
  data: { members: Member[]; invites: Invite[]; seats: Seats };
}

const ROLES: StaffRole[] = ['TRAINER', 'MEDICAL', 'VIEWER', 'ADMIN'];

export function StaffCard() {
  const t = useTranslations('settings.staff');
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const planKey = tierToPlanKey(user?.organization?.tier);
  // Su Ultra non c'e' un piano superiore: l'unico modo di fare posto e'
  // comprarlo. Sotto, invece, passare di piano costa meno di un posto
  // singolo, quindi proporre il posto sarebbe un cattivo consiglio.
  const canUpgradePlan = planKey !== 'ULTRA';

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [seats, setSeats] = useState<Seats | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('TRAINER');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [noSeat, setNoSeat] = useState(false);
  const [sentTo, setSentTo] = useState('');
  /**
   * Link dell'invito appena creato.
   *
   * Mostrato UNA volta sola, subito dopo l'invio, e mai piu' riletto
   * dall'elenco: il link contiene il token, e chi lo ha in mano entra
   * nell'organizzazione con il ruolo scritto nell'invito. Tenerlo nella lista
   * dei pendenti — che qualunque membro puo' leggere — vorrebbe dire che un
   * utente in sola lettura si prende l'invito da amministratore del collega.
   *
   * Serve comunque averlo: l'email puo' finire nello spam, l'indirizzo puo'
   * essere sbagliato, e in sviluppo non parte affatto.
   */
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<StaffResponse>('/staff');
      setMembers(res.data.members);
      setInvites(res.data.invites);
      setSeats(res.data.seats);
    } catch {
      // Una scheda staff che non carica non deve rompere le Impostazioni:
      // resta vuota e il resto della pagina funziona.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNoSeat(false);
    setSentTo('');
    setInviteLink('');
    setCopied(false);
    setSending(true);
    try {
      const res = await apiFetch<{ data: { inviteLink: string } }>('/staff/invite', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role }),
      });
      setSentTo(email.trim());
      setInviteLink(res.data.inviteLink);
      setEmail('');
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NO_SEAT_AVAILABLE') {
        setNoSeat(true);
      } else {
        setError(err instanceof Error ? err.message : t('inviteError'));
      }
    } finally {
      setSending(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await apiFetch(`/staff/invite/${id}/revoke`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('inviteError'));
    }
  };

  const disable = async (id: string) => {
    try {
      await apiFetch(`/staff/members/${id}/disable`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('inviteError'));
    }
  };

  if (loading) return null;

  const full = !!seats && seats.available < 1;

  return (
    <div className="card dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Users className="h-5 w-5 text-teal-600" />
          {t('title')}
        </h2>
        {seats && (
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold ${
              full
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-teal-600/10 text-teal-700 dark:text-teal-400'
            }`}
          >
            {t('seatsUsed', { used: seats.used, total: seats.total })}
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{t('intro')}</p>

      {/* Membri */}
      <ul className="mb-4 divide-y divide-slate-100 dark:divide-slate-700">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {m.firstName} {m.lastName}
                {m.id === user?.id && (
                  <span className="ml-2 text-xs font-normal text-slate-400">{t('you')}</span>
                )}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{m.email}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {t(`role.${m.role}`)}
              </span>
              {!m.isActive && (
                <span className="text-xs text-slate-400">{t('disabled')}</span>
              )}
              {isAdmin && m.isActive && m.id !== user?.id && (
                <button
                  type="button"
                  onClick={() => disable(m.id)}
                  className="text-xs font-medium text-slate-400 hover:text-danger-600"
                >
                  {t('disable')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Inviti in sospeso */}
      {invites.length > 0 && (
        <ul className="mb-4 space-y-2">
          {invites.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 px-3 py-2 dark:border-slate-600"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Clock className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <span className="truncate text-sm text-slate-700 dark:text-slate-300">{i.email}</span>
                <span className="flex-shrink-0 text-xs text-slate-400">{t(`role.${i.role}`)}</span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => revoke(i.id)}
                  className="flex-shrink-0 text-slate-400 hover:text-danger-600"
                  aria-label={t('revoke')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Invito */}
      {isAdmin ? (
        <>
          {sentTo && (
            <div className="mb-3 rounded-lg border border-teal-600/20 bg-teal-50 px-3 py-2.5 text-xs text-teal-800 dark:bg-teal-900/20 dark:text-teal-300">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 flex-shrink-0" />
                {t('inviteSent', { email: sentTo })}
              </p>
              {inviteLink && (
                <>
                  <p className="mt-2 text-[0.7rem] opacity-80">{t('inviteLinkHint')}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-white/60 px-2 py-1 text-[0.7rem] dark:bg-slate-900/40">
                      {inviteLink}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(inviteLink)
                          .then(() => setCopied(true))
                          // Senza il ramo di errore, su un contesto non sicuro
                          // (http su rete locale) il click non fa niente e non
                          // lo dice: meglio lasciare il link selezionabile a
                          // mano e non fingere che sia andata bene.
                          .catch(() => setCopied(false));
                      }}
                      className="flex-shrink-0 rounded border border-teal-600/30 px-2 py-1 font-medium hover:bg-white/60 dark:hover:bg-slate-900/40"
                    >
                      {copied ? t('copied') : t('copy')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-lg border border-danger-500/20 bg-danger-50 px-3 py-2 text-xs text-danger-700">
              {error}
            </div>
          )}

          {noSeat || full ? (
            /* Posti esauriti.
               Su un piano non-Ultra il passaggio di piano costa MENO di un
               posto singolo (Ultra da' quattro posti a meno di due posti
               comprati), quindi proporre prima il posto sarebbe vendere alla
               persona la cosa sbagliata. */
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
                {t('fullTitle')}
              </p>
              <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
                {canUpgradePlan ? t('fullUpgradeHint') : t('fullSeatHint')}
              </p>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow"
              >
                {canUpgradePlan ? t('fullUpgradeCta') : t('fullSeatCta')}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="staffEmail" className="label mb-1.5 block dark:text-slate-300">
                  {t('inviteEmail')}
                </label>
                <input
                  id="staffEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('invitePlaceholder')}
                  className="input-field dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  required
                  disabled={sending}
                />
              </div>
              <div>
                <label htmlFor="staffRole" className="label mb-1.5 block dark:text-slate-300">
                  {t('inviteRole')}
                </label>
                <select
                  id="staffRole"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="input-field dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  disabled={sending}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`role.${r}`)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                {sending ? t('inviting') : t('invite')}
              </button>
            </form>
          )}
        </>
      ) : (
        <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          {t('adminOnly')}
        </p>
      )}
    </div>
  );
}
