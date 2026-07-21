'use client';

import { useContext } from 'react';
import { TeamContext, type TeamContextType } from '@/lib/team/context';

export function useTeam(): TeamContextType {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
