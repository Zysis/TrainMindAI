'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';

interface WeeklyPoint {
  week: number;
  label: string;
  mesocycleName: string;
  phase: string;
  plannedLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  acwr: number;
  fatigue: number;
  fitness: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
}

interface LoadCurveChartProps {
  data: WeeklyPoint[];
  mode: 'load' | 'acwr' | 'fitness';
}

const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  moderate: '#f59e0b',
  high: '#ef4444',
  very_high: '#991b1b',
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; payload?: WeeklyPoint }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as WeeklyPoint | undefined;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs shadow-lg">
      <p className="font-semibold text-slate-900 dark:text-white">{label} — {point?.mesocycleName}</p>
      <p className="text-slate-500 dark:text-slate-400">{point?.phase}</p>
      <div className="mt-2 space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-600 dark:text-slate-400">{p.name}:</span>
            <span className="font-medium text-slate-900 dark:text-white">{typeof p.value === 'number' ? p.value.toFixed(p.name === 'ACWR' ? 2 : 0) : p.value}</span>
          </div>
        ))}
      </div>
      {point && (
        <div className="mt-2 flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK_COLORS[point.riskLevel] }} />
          <span className="text-slate-500 dark:text-slate-400">Rischio: {point.riskLevel === 'very_high' ? 'molto alto' : point.riskLevel === 'high' ? 'alto' : point.riskLevel === 'moderate' ? 'moderato' : 'basso'}</span>
        </div>
      )}
    </div>
  );
}

export function LoadCurveChart({ data, mode }: LoadCurveChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Esegui una simulazione per visualizzare le curve
      </div>
    );
  }

  // Find risk windows for reference areas
  const riskAreas: Array<{ x1: number; x2: number; level: string }> = [];
  let currentRisk: { start: number; level: string } | null = null;
  for (const p of data) {
    if (p.riskLevel === 'high' || p.riskLevel === 'very_high') {
      if (!currentRisk) currentRisk = { start: p.week, level: p.riskLevel };
    } else if (currentRisk) {
      riskAreas.push({ x1: currentRisk.start, x2: p.week - 1, level: currentRisk.level });
      currentRisk = null;
    }
  }
  if (currentRisk) riskAreas.push({ x1: currentRisk.start, x2: data[data.length - 1].week, level: currentRisk.level });

  if (mode === 'load') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {riskAreas.map((ra, i) => (
            <ReferenceArea key={i} x1={`S${ra.x1}`} x2={`S${ra.x2}`} fill={ra.level === 'very_high' ? '#fee2e2' : '#fef3c7'} fillOpacity={0.5} />
          ))}
          <Bar dataKey="plannedLoad" name="Carico pianificato" fill="#99f6e4" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="acuteLoad" name="Carico acuto" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="chronicLoad" name="Carico cronico" stroke="#6366f1" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (mode === 'acwr') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis domain={[0, 2]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceArea y1={0.8} y2={1.3} fill="#dcfce7" fillOpacity={0.4} label={{ value: 'Sweet spot', position: 'insideTopRight', fontSize: 10, fill: '#16a34a' }} />
          <ReferenceArea y1={1.3} y2={1.5} fill="#fef9c3" fillOpacity={0.4} />
          <ReferenceArea y1={1.5} y2={2.0} fill="#fee2e2" fillOpacity={0.4} label={{ value: 'Danger zone', position: 'insideTopRight', fontSize: 10, fill: '#dc2626' }} />
          <ReferenceLine y={1.0} stroke="#94a3b8" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="acwr" name="ACWR" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444' }} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // Fitness/fatigue
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="fitness" name="Fitness" stroke="#10b981" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="fatigue" name="Fatica" stroke="#ef4444" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
