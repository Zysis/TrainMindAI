'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, Plus, LayoutGrid, List } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useTeam } from '@/hooks/use-team';
import { POSITION_OPTIONS } from '@/lib/constants/positions';
import type { Athlete, AthleteListResponse } from '@/types';

const positions = [{ value: '', label: '' }, ...POSITION_OPTIONS];

export default function AthletesPage() {
  const router = useRouter();
  const t = useTranslations('athletes');
  const { toast } = useToast();
  const { selectedTeamId } = useTeam();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [form, setForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '', position: 'Point Guard',
    jerseyNumber: '', height: '', weight: '',
  });

  const loadAthletes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search) params.set('search', search);
      if (posFilter) params.set('position', posFilter);
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
  }, [page, search, posFilter, selectedTeamId]);

  useEffect(() => {
    const timer = setTimeout(loadAthletes, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadAthletes]);

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
        }),
      });
      toast('success', t('athleteCreated'));
      setShowCreate(false);
      setForm({ firstName: '', lastName: '', dateOfBirth: '', position: 'Point Guard', jerseyNumber: '', height: '', weight: '' });
      loadAthletes();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('createError'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
          <Plus className="h-4 w-4" />
          {t('newAthlete')}
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input type="text" placeholder={t('searchByName')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-500 dark:placeholder:text-slate-500 dark:text-slate-400 focus:outline-none" />
        </div>
        <select value={posFilter} onChange={(e) => { setPosFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300">
          {positions.map((p) => <option key={p.value} value={p.value}>{p.value === '' ? t('allPositions') : p.label}</option>)}
        </select>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button onClick={() => setViewMode('grid')} className={`p-2.5 ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-700 text-teal-700' : 'text-slate-400 dark:text-slate-500'}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode('table')} className={`p-2.5 ${viewMode === 'table' ? 'bg-slate-100 dark:bg-slate-700 text-teal-700' : 'text-slate-400 dark:text-slate-500'}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : athletes.length === 0 ? (
        <div className="card flex h-48 items-center justify-center">
          <p className="text-sm text-slate-400 dark:text-slate-500">{t('noAthletesFound')}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {athletes.map((a) => (
            <div key={a.id} onClick={() => router.push(`/dashboard/athletes/${a.id}`)}
              className="card-hover cursor-pointer">
              <div className="flex items-center gap-4">
                <Avatar firstName={a.firstName} lastName={a.lastName} size="lg" />
                <div className="flex-1 min-w-0">
                  <h3 className="truncate font-semibold text-slate-900 dark:text-white">{a.firstName} {a.lastName}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{a.position}</p>
                </div>
                {a.jerseyNumber !== null && (
                  <span className="text-2xl font-bold text-slate-200 dark:text-slate-700">#{a.jerseyNumber}</span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                {a.height && <span className="text-xs text-slate-500 dark:text-slate-400">{a.height} cm</span>}
                {a.weight && <span className="text-xs text-slate-500 dark:text-slate-400">{a.weight} kg</span>}
                <Badge variant={a.isActive ? 'success' : 'default'} className="ml-auto">
                  {a.isActive ? t('active') : t('inactive')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="table-scroll"><table className="w-full text-sm">
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
                <tr key={a.id} onClick={() => router.push(`/dashboard/athletes/${a.id}`)}
                  className="cursor-pointer border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar firstName={a.firstName} lastName={a.lastName} size="sm" />
                      <span className="font-medium text-slate-900 dark:text-white">{a.firstName} {a.lastName}</span>
                    </div>
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-400">{a.position}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-400">{a.jerseyNumber ?? '-'}</td>
                  <td className="py-3 text-slate-500 dark:text-slate-400">{a.height ? `${a.height}cm` : '-'} / {a.weight ? `${a.weight}kg` : '-'}</td>
                  <td className="py-3"><Badge variant={a.isActive ? 'success' : 'default'}>{a.isActive ? t('active') : t('inactive')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`h-8 w-8 rounded-lg text-sm font-medium ${p === page ? 'bg-teal-700 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700'}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('newAthlete')} size="lg"
        footer={
          <>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">{t('cancel')}</button>
            <button onClick={handleCreate} disabled={creating} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
              {creating ? t('creating') : t('createAthlete')}
            </button>
          </>
        }>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
          <Input label={t('firstName')} required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <Input label={t('lastName')} required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
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
