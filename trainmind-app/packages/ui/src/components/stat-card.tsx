import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: number; label: string };
  /** `lg` ingrandisce numero, icona e spaziatura. Default invariato: la
   *  card e' usata anche fuori dalla Dashboard e non deve cambiare li'. */
  size?: 'md' | 'lg';
  className?: string;
}

export function StatCard({ label, value, subtitle, icon: Icon, iconColor = 'bg-teal-100 text-teal-700', trend, size = 'md', className }: StatCardProps) {
  const lg = size === 'lg';
  return (
    <div className={cn('card flex items-start', lg ? 'gap-5 p-6' : 'gap-4', className)}>
      <div className={cn('rounded-xl', lg ? 'p-3.5' : 'p-3', iconColor)}>
        <Icon className={lg ? 'h-6 w-6' : 'h-5 w-5'} />
      </div>
      <div className="flex-1">
        <p className={cn('font-bold text-slate-900 dark:text-white', lg ? 'text-3xl' : 'text-2xl')}>{value}</p>
        <p className={cn('font-medium text-slate-700 dark:text-slate-300', lg ? 'text-base' : 'text-sm')}>{label}</p>
        {subtitle && <p className={cn('text-slate-500 dark:text-slate-400', lg ? 'text-sm' : 'text-xs')}>{subtitle}</p>}
        {trend && (
          <p className={cn('mt-1 text-xs font-medium', trend.value >= 0 ? 'text-success-500' : 'text-danger-500')}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}
