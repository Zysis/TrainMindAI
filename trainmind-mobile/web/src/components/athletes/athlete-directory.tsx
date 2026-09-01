'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, Plus, LayoutGrid, List, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useTeam } from '@/hooks/use-team';
import { POSITION_OPTIONS, positionShort } from '@/lib/constants/positions';
import type { Athlete, AthleteListResponse } from '@/types';

const positions = [{ value: '', label: '' }, ...POSITION_OPTIONS];

/** Dove si ricorda se la lista e' aperta */
const OPEN_KEY = 'trainmind.teams.athleteList';

interface Props {
  /** Ricaricare la lista dall'esterno, es. dopo aver tolto un atleta da una squadra */
  refreshKey?: number;
  /** Avvisa la pagina ospite che la rosa e' cambiata */
  onChanged?: () => void;
}

/**
 * Elenco completo degli atleti dell'organizzazione: ricerca, filtro ruolo,
 * griglia/tabella, paginazione e creazione.
 *
 * Vive qui e non in una pagina propria perche' sta in fondo alla scheda Squadre:
 * una lista sola, un posto solo. Il dettaglio del singolo atleta resta una
 * pagina a se' (`/dashboard/athletes/[id]`).
 */
export function AthleteDirectory({ refreshKey = 0, onChanged }: Props) {
  const router = useRouter();
  const t = useTranslations('athletes');
  const apiError = useApiError();
  const { toast } = useToast();
  const { selectedTeamId } = useTeam();

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Aperta di default: nasconderla al primo accesso vorrebbe dire non farla
  // trovare. Una volta chiusa pero' resta chiusa.
  const [open, setOpen] = useState(true);

  // La preferenza si legge dopo il mount, altrimenti server e client
  // renderizzerebbero due cose diverse e Next segnalerebbe l'idratazione.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OPEN_KEY);
      if (saved === '0') setOpen(false);
    } catch {
      // storage non disponibile: la lista resta aperta
    }
  }, []);

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      try { window.localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* pazienza */ }
      return next;
    });
  };

  const [form, setForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '', position: 'PG',
    jerseyNumber: '', height: '', weight: '', email: '',
  });

  const loadAthletes = useCallback(async () => {
    if (!open) return; // chiusa: niente da mostrare, niente da chiedere
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search) params.set('search', search);
      if (posFilter) params.set('position', posFilter);
      // L'interruttore commuta la vista: o gli attivi, o i soli archiviati.
      if (showArchived) params.set('isActive', 'false');
      if (selectedTeamId) params.set('teamId', selectedTeamId);
      const res = await apiFetch<AthleteListResponse>(`/athletes?${params}`);
      setAthletes(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, posFilter, selectedTeamId, refreshKey, open, showArchived]);

  useEffect(() => {
    const timer = setTimeout(loadAthletes, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadAthletes]);

  const handleRestore = async (athlete: Athlete) => {
    try {
      await apiFetch(`/athletes/${athlete.id}/restore`, { method: 'POST', body: JSON.stringify({}) });
      toast('success', t('restoredMsg'));
      loadAthletes();
      onChanged?.();
    } catch (err) {
      toast('error', apiError(err, t('restoreError')));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch('/athletes', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          position: form.position,
          jerseyNumber: form.jerseyNumber ? Number(form.jerseyNumber) : undefined,
          height: form.height ? Number(form.height) : undefined,
          weight: form.weight ? Number(form.weight) : undefined,
          email: form.email || undefined,
        }),
      });
      toast('success', t('athleteCreated'));
      setShowCreate(false);
      setForm({ firstName: '', lastName: '', dateOfBirth: '', position: 'PG', jerseyNumber: '', height: '', weight: '', email: '' });
      loadAthletes();
      onChanged?.();
    } catch (err) {
      toast('error', apiError(err, t('createError')));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Intestazione */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={toggleOpen}
            aria-expanded={open}
            className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-lg font-bold text-slate-900 dark:text-white transition-colors hover:text-teal-700 dark:hover:text-teal-300"
          >
            {open ? (
              <ChevronUp className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            )}
            {showArchived ? t('archivedTitle') : t('title')}
            {open && total > 0 && (
              <span className="text-sm font-normal text-slate-400 dark:text-slate-500">({total})</span>
            )}
          </button>
          {open && <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>}
        </div>
        {open && !showArchived && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            {t('newAthlete')}
          </button>
        )}
      </div>

      {open && (
      <>
      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder={t('searchByName')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        <select
          value={posFilter}
          onChange={(e) => { setPosFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300"
        >
          {positions.map((p) => (
            <option key={p.value} value={p.value}>{p.value === '' ? t('allPositions') : p.label}</option>
          ))}
        </select>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          {t('showArchived')}
        </label>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2.5 ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-700 text-teal-700' : 'text-slate-400 dark:text-slate-500'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2.5 ${viewMode === 'table' ? 'bg-slate-100 dark:bg-slate-700 text-teal-700' : 'text-slate-400 dark:text-slate-500'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Contenuto */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : athletes.length === 0 ? (
        <div className="card flex h-48 items-center justify-center">
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {showArchived ? t('noArchivedFound') : t('noAthletesFound')}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {athletes.map((a) => (
            <div
              key={a.id}
              onClick={() => router.push(`/dashboard/athletes/${a.id}`)}
              className={`card-hover cursor-pointer ${a.isActive ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center gap-4">
                <Avatar firstName={a.firstName} lastName={a.lastName} size="lg" />
                <div className="flex-1 min-w-0">
                  <h3 className="truncate font-semibold text-slate-900 dark:text-white">{a.firstName} {a.lastName}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{positionShort(a.position)}</p>
                </div>
                {a.jerseyNumber !== null && (
                  <span className="text-2xl font-bold text-slate-200 dark:text-slate-700">#{a.jerseyNumber}</span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                {a.height && <span className="text-xs text-slate-500 dark:text-slate-400">{a.height} cm</span>}
                {a.weight && <span className="text-xs text-slate-500 dark:text-slate-400">{a.weight} kg</span>}
                {a.isActive ? (
                  <Badge variant="success" className="ml-auto">{t('active')}</Badge>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRestore(a); }}
                    className="ml-auto inline-flex items-center gap-1 rounded-md border border-teal-600 px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-500 dark:hover:bg-teal-950"
                  >
                    <RotateCcw className="h-3 w-3" /> {t('restore')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                <th className="pb-3 font-medium text-slate-500 dark:text-slate-400">{t('tableHeaderAthlete')}</th>
                <th className="pb-3 font-medium text-slate-500 dark:text-slate-400">{t('tableHeaderPosition')}</th>
                <th className="pb-3 font-medium text-slate-500 dark:text-slate-400">{t('tableHeaderJersey')}</th>
                <th className="pb-3 font-medium text-slate-500 dark:text-slate-400">{t('tableHeaderPhysical')}</th>
                <th className="pb-3 font-medium text-slate-500 dark:text-slate-400">{t('tableHeaderStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {athletes.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => router.push(`/dashboard/athletes/${a.id}`)}
                  className={`cursor-pointer border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 ${a.isActive ? '' : 'opacity-60'}`}
                >
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar firstName={a.firstName} lastName={a.lastName} size="sm" />
                      <span className="font-medium text-slate-900 dark:text-white">{a.firstName} {a.lastName}</span>
                    </div>
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-400">{positionShort(a.position)}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-400">{a.jerseyNumber ?? '-'}</td>
                  <td className="py-3 text-slate-500 dark:text-slate-400">
                    {a.height ? `${a.height}cm` : '-'} / {a.weight ? `${a.weight}kg` : '-'}
                  </td>
                  <td className="py-3">
                    {a.isActive ? (
                      <Badge variant="success">{t('active')}</Badge>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestore(a); }}
                        className="inline-flex items-center gap-1 rounded-md border border-teal-600 px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-500 dark:hover:bg-teal-950"
                      >
                        <RotateCcw className="h-3 w-3" /> {t('restore')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`h-8 w-8 rounded-lg text-sm font-medium ${
                p === page ? 'bg-teal-700 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      </>
      )}

      {/* Nuovo atleta */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t('newAthlete')}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {creating ? t('creating') : t('createAthlete')}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
          <Input label={t('firstName')} required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <Input label={t('lastName')} required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <div className="col-span-2">
            <Input label={t('email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t('emailPlaceholder')} />
          </div>
          <Input label={t('birthDate')} type="date" required value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          <Select label={t('position')} options={positions.slice(1)} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <Input label={t('jerseyNumber')} type="number" value={form.jerseyNumber} onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })} />
          <Input label={t('heightCm')} type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
          <Input label={t('weightKg')} type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
