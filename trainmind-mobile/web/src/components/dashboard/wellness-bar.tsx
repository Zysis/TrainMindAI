'use client';

export function WellnessBar({ label, value, max, invert }: { label: string; value: number; max: number; invert?: boolean }) {
  const pct = (value / max) * 100;
  const isGood = invert ? value <= 2.5 : value >= 3;
  const color = isGood ? 'bg-emerald-500' : value >= (invert ? 3.5 : 0) ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className={`font-semibold ${isGood ? 'text-emerald-600' : 'text-amber-600'}`}>{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
