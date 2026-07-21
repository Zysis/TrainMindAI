import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth/fetch';
import type { Athlete } from '@/types';

export function useAthletes(teamId?: string) {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (params?: { search?: string; position?: string }) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '100' });
      if (params?.search) qs.set('search', params.search);
      if (params?.position) qs.set('position', params.position);
      if (teamId) qs.set('teamId', teamId);
      const res = await apiFetch<{ data: Athlete[]; meta: { total: number } }>(`/athletes?${qs}`);
      setAthletes(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  return { athletes, loading, total, load };
}
