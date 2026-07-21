import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ label, value, subtitle, icon: Icon, iconColor = 'bg-teal-100 text-teal-700', trend, className }: StatCardProps) {
  return (
    <div className={cn('card flex items-start gap-4', className)}>
      <div className={cn('rounded-xl p-3', iconColor)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        {trend && (
          <p className={cn('mt-1 text-xs font-medium', trend.value >= 0 ? 'text-success-500' : 'text-danger-500')}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}
