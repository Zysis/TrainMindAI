'use client';

import { useAuthStore } from '@/stores/auth-store';
import { User, Mail, MapPin, Ruler, Weight, Hash, LogOut, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  if (!user?.athlete) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const { athlete, organization } = user;

  return (
    <div className="px-4 py-6">
      {/* Avatar + Name */}
      <div className="mb-6 flex flex-col items-center">
        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 text-2xl font-bold text-teal-700 dark:bg-teal-900 dark:text-teal-300">
          {athlete.photoUrl ? (
            <img src={athlete.photoUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            `${athlete.firstName[0]}${athlete.lastName[0]}`
          )}
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {athlete.firstName} {athlete.lastName}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{organization.name}</p>
      </div>

      {/* Info cards */}
      <div className="space-y-2">
        <InfoRow icon={<User size={16} />} label="Ruolo" value={athlete.position} />
        <InfoRow icon={<Hash size={16} />} label="Numero" value={athlete.jerseyNumber?.toString() || '-'} />
        <InfoRow icon={<Ruler size={16} />} label="Altezza" value={athlete.height ? `${athlete.height} cm` : '-'} />
        <InfoRow icon={<Weight size={16} />} label="Peso" value={athlete.weight ? `${athlete.weight} kg` : '-'} />
        <InfoRow icon={<Mail size={16} />} label="Email" value={user.email} />
        <InfoRow
          icon={<MapPin size={16} />}
          label="Squadre"
          value={athlete.teams.length > 0 ? athlete.teams.map((t) => t.name).join(', ') : '-'}
        />
        <InfoRow icon={<Shield size={16} />} label="Organizzazione" value={organization.name} />
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-danger-500 px-4 py-3 text-sm font-semibold text-danger-500 transition hover:bg-danger-50 dark:hover:bg-danger-700/20"
      >
        <LogOut size={16} /> Esci
      </button>

      <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-600">
        TrainMind Athlete v0.1.0
      </p>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
      <span className="text-teal-500">{icon}</span>
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="ml-auto text-sm font-medium text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}
