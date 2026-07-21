'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Search, Edit2, Trash2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { useTeam } from '@/hooks/use-team';
import { POSITION_OPTIONS } from '@/lib/constants/positions';
import type { Team, TeamDetail } from '@/types';

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

export default function TeamsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { refreshTeams, selectedTeamId, selectTeam } = useTeam();
  const t = useTranslations('teams');
  const tCommon = useTranslations('common');

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#3b82f6' });
  const [saving, setSaving] = useState(false);

  // Team detail
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Add athlete modal
  const [showAddAthlete, setShowAddAthlete] = useState(false);
  const [allAthletes, setAllAthletes] = useState<Array<{ id: string; firstName: string; lastName: string; position: string }>>([]);
  const [addingAthletes, setAddingAthletes] = useState(false);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);

  // Create new athlete modal
  const [showCreateAthlete, setShowCreateAthlete] = useState(false);
  const [creatingAthlete, setCreatingAthlete] = useState(false);
  const [athleteForm, setAthleteForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '', position: 'Point Guard',
    jerseyNumber: '', team: '', photoUrl: null as string | null,
  });

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      const res = await apiFetch<{ data: Team[] }>(`/teams?${params}`);
      setTeams(res.data || []);
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(loadTeams, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadTeams]);

  const loadTeamDetail = useCallback(async (teamId: string) => {
    setLoadingDetail(true);
    try {
      const res = await apiFetch<{ data: TeamDetail }>(`/teams/${teamId}`);
      setSelectedTeam(res.data);
    } catch (err) {
      console.error('Failed to load team detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const openCreate = () => {
    setEditingTeam(null);
    setForm({ name: '', description: '', color: '#3b82f6' });
    setShowModal(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setForm({ name: team.name, description: team.description || '', color: team.color || '#3b82f6' });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || undefined,
        color: form.color,
      };

      if (editingTeam) {
        await apiFetch(`/teams/${editingTeam.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast('success', t('teamUpdated'));
      } else {
        await apiFetch('/teams', { method: 'POST', body: JSON.stringify(body) });
        toast('success', t('teamCreated'));
      }

      setShowModal(false);
      loadTeams();
      refreshTeams();
      if (selectedTeam && editingTeam?.id === selectedTeam.id) {
        loadTeamDetail(selectedTeam.id);
      }
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (team: Team) => {
    if (!confirm(t('deleteConfirm', { name: team.name }))) return;
    try {
      await apiFetch(`/teams/${team.id}`, { method: 'DELETE' });
      toast('success', t('teamDeleted'));
      if (selectedTeam?.id === team.id) setSelectedTeam(null);
      if (selectedTeamId === team.id) selectTeam(null);
      loadTeams();
      refreshTeams();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('deleteError'));
    }
  };

  const openAddAthlete = async () => {
    setShowAddAthlete(true);
    setSelectedAthleteIds([]);
    try {
      const res = await apiFetch<{ data: Array<{ id: string; firstName: string; lastName: string; position: string }> }>('/athletes?limit=100');
      // Filter out athletes already in team
      const existingIds = new Set(selectedTeam?.athletes.map((a) => a.id) || []);
      setAllAthletes((res.data || []).filter((a) => !existingIds.has(a.id)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAthletes = async () => {
    if (!selectedTeam || selectedAthleteIds.length === 0) return;
    setAddingAthletes(true);
    try {
      await apiFetch(`/teams/${selectedTeam.id}/athletes`, {
        method: 'POST',
        body: JSON.stringify({ athleteIds: selectedAthleteIds }),
      });
      toast('success', t('athletesAdded', { count: selectedAthleteIds.length }));
      setShowAddAthlete(false);
      loadTeamDetail(selectedTeam.id);
      loadTeams();
      refreshTeams();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setAddingAthletes(false);
    }
  };

  const handleRemoveAthlete = async (athleteId: string) => {
    if (!selectedTeam) return;
    try {
      await apiFetch(`/teams/${selectedTeam.id}/athletes/${athleteId}`, { method: 'DELETE' });
      toast('success', t('athleteRemoved'));
      loadTeamDetail(selectedTeam.id);
      loadTeams();
      refreshTeams();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : tCommon('error'));
    }
  };

  const openCreateAthlete = () => {
    setAthleteForm({ firstName: '', lastName: '', dateOfBirth: '', position: 'Point Guard', jerseyNumber: '', team: selectedTeam?.name || '' });
    setShowCreateAthlete(true);
  };

  const handleCreateAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    setCreatingAthlete(true);
    try {
      const res = await apiFetch<{ data: { id: string } }>('/athletes', {
        method: 'POST',
        body: JSON.stringify({
          firstName: athleteForm.firstName,
          lastName: athleteForm.lastName,
          dateOfBirth: athleteForm.dateOfBirth,
          position: athleteForm.position,
          jerseyNumber: athleteForm.jerseyNumber ? Number(athleteForm.jerseyNumber) : undefined,
          team: athleteForm.team || undefined,
          photoUrl: athleteForm.photoUrl || undefined,
        }),
      });
      // Assign to current team
      await apiFetch(`/teams/${selectedTeam.id}/athletes`, {
        method: 'POST',
        body: JSON.stringify({ athleteIds: [res.data.id] }),
      });
      toast('success', t('athleteCreatedAdded'));
      setShowCreateAthlete(false);
      loadTeamDetail(selectedTeam.id);
      loadTeams();
      refreshTeams();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('createError'));
    } finally {
      setCreatingAthlete(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
          <Plus className="h-4 w-4" />
          {t('newTeam')}
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder={t('searchTeam')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-500 dark:placeholder:text-slate-500 dark:text-slate-400 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Teams list */}
        <div className="space-y-3 lg:col-span-1">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
            </div>
          ) : teams.length === 0 ? (
            <div className="card flex h-48 flex-col items-center justify-center gap-3">
              <Users className="h-10 w-10 text-slate-300 dark:text-slate-500" />
              <p className="text-sm text-slate-400 dark:text-slate-500">{t('noTeamsCreated')}</p>
              <button onClick={openCreate} className="text-sm font-medium text-teal-600 hover:text-teal-700">
                {t('createFirstTeam')}
              </button>
            </div>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                onClick={() => loadTeamDetail(team.id)}
                className={`card-hover cursor-pointer transition-all ${selectedTeam?.id === team.id ? 'ring-2 ring-teal-500' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold text-sm"
                    style={{ backgroundColor: team.color || '#64748b' }}
                  >
                    {team.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{team.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('teamCountInfo', { athletes: team._count.athleteTeams, trainings: team._count.trainingPlans, periodizations: team._count.periodizationPlans })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(team); }}
                      className="rounded p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(team); }}
                      className="rounded p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Team detail panel */}
        <div className="lg:col-span-2">
          {loadingDetail ? (
            <div className="card flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
            </div>
          ) : selectedTeam ? (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-white font-bold text-lg"
                    style={{ backgroundColor: selectedTeam.color || '#64748b' }}
                  >
                    {selectedTeam.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedTeam.name}</h2>
                    {selectedTeam.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{selectedTeam.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openCreateAthlete}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    <UserPlus className="h-4 w-4" />
                    {t('newAthlete')}
                  </button>
                  <button
                    onClick={openAddAthlete}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
                  >
                    <Plus className="h-4 w-4" />
                    {t('addExisting')}
                  </button>
                </div>
              </div>

              {/* Athletes in team */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t('athletesCount', { count: selectedTeam.athletes.length })}
                </h3>
                {selectedTeam.athletes.length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-400 dark:text-slate-500">{t('noAthletesInTeam')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selectedTeam.athletes.map((athlete) => (
                      <div
                        key={athlete.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-600 transition-colors"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
                          {athlete.firstName[0]}{athlete.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => router.push(`/dashboard/athletes/${athlete.id}`)}
                            className="font-medium text-slate-900 dark:text-white hover:text-teal-700 text-sm truncate block"
                          >
                            {athlete.firstName} {athlete.lastName}
                          </button>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{athlete.position}{athlete.jerseyNumber !== null ? ` · #${athlete.jerseyNumber}` : ''}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveAthlete(athlete.id)}
                          className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-500"
                          title={t('removeFromTeam')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card flex h-64 flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
              <Users className="h-12 w-12" />
              <p className="text-sm">{t('selectTeamDetail')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Team Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingTeam ? t('editTeam') : t('newTeam')}
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">
              {t('cancel')}
            </button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
              {saving ? t('saving') : editingTeam ? t('save') : t('createTeam')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input label={t('teamName')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('teamNamePlaceholder')} />
          <Input label={t('descriptionLabel')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('descriptionPlaceholder')} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('colorLabel')}</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-8 w-8 rounded-full transition-transform ${form.color === c ? 'scale-110 ring-2 ring-offset-2 ring-teal-500' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* Add Athlete Modal */}
      <Modal
        open={showAddAthlete}
        onClose={() => setShowAddAthlete(false)}
        title={t('addAthletesToTeam')}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowAddAthlete(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">
              {t('cancel')}
            </button>
            <button onClick={handleAddAthletes} disabled={addingAthletes || selectedAthleteIds.length === 0} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
              {addingAthletes ? t('adding') : t('addCount', { count: selectedAthleteIds.length })}
            </button>
          </>
        }
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {allAthletes.length === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">{t('allAthletesInTeam')}</p>
          ) : (
            allAthletes.map((a) => (
              <label key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">
                <input
                  type="checkbox"
                  checked={selectedAthleteIds.includes(a.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAthleteIds([...selectedAthleteIds, a.id]);
                    } else {
                      setSelectedAthleteIds(selectedAthleteIds.filter((id) => id !== a.id));
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-teal-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{a.firstName} {a.lastName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{a.position}</p>
                </div>
              </label>
            ))
          )}
        </div>
      </Modal>

      {/* Create New Athlete Modal */}
      <Modal
        open={showCreateAthlete}
        onClose={() => setShowCreateAthlete(false)}
        title={t('newAthleteModal')}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowCreateAthlete(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">
              {t('cancel')}
            </button>
            <button onClick={handleCreateAthlete} disabled={creatingAthlete || !athleteForm.firstName || !athleteForm.lastName || !athleteForm.dateOfBirth} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
              {creatingAthlete ? t('creating') : t('createAthlete')}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateAthlete} className="space-y-4">
          <div className="flex justify-center">
            <PhotoPicker
              value={athleteForm.photoUrl}
              onChange={(url) => setAthleteForm({ ...athleteForm, photoUrl: url })}
              label={t('photo')}
              size={96}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
          <Input label={t('firstName')} required value={athleteForm.firstName} onChange={(e) => setAthleteForm({ ...athleteForm, firstName: e.target.value })} />
          <Input label={t('lastName')} required value={athleteForm.lastName} onChange={(e) => setAthleteForm({ ...athleteForm, lastName: e.target.value })} />
          <Input label={t('birthDate')} type="date" required value={athleteForm.dateOfBirth} onChange={(e) => setAthleteForm({ ...athleteForm, dateOfBirth: e.target.value })} />
          <Select
            label={t('role')}
            options={POSITION_OPTIONS}
            value={athleteForm.position}
            onChange={(e) => setAthleteForm({ ...athleteForm, position: e.target.value })}
          />
          <Input label={t('jerseyNumber')} type="number" value={athleteForm.jerseyNumber} onChange={(e) => setAthleteForm({ ...athleteForm, jerseyNumber: e.target.value })} />
          <Input label={t('team')} value={athleteForm.team} onChange={(e) => setAthleteForm({ ...athleteForm, team: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
