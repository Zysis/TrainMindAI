import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth/fetch';
import type { Exercise } from '@/types';

export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (params?: { search?: string; category?: string; onlyCustom?: boolean }) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '100' });
      if (params?.search) qs.set('search', params.search);
      if (params?.category) qs.set('category', params.category);
      if (params?.onlyCustom) qs.set('onlyCustom', 'true');
      const res = await apiFetch<{ data: Exercise[]; meta: { total: number } }>(`/exercises?${qs}`);
      setExercises(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { exercises, loading, total, load };
}
