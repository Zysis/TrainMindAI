'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Palette categorica della console — tre tinte, ordine fisso.
 *
 * Validata con lo script six-checks su fondo chiaro: banda di luminosita' ok,
 * croma sopra la soglia, separazione per daltonismo deutan 22.2 e tritan 11.2,
 * contrasto sul fondo sopra 3:1. Sono le tinte gia' presenti nel tema
 * dell'app (teal-600, info-700, warning-700), quindi la console non stona.
 *
 * L'ordine NON si mescola mai: il colore segue l'entita', non la posizione in
 * classifica. Se un filtro riduce le serie, le superstiti tengono il colore.
 */
export const SERIES = ['#0D9488', '#1D4ED8', '#B45309'] as const;
const INK = '#64748B'; // slate-500 — assi ed etichette
const GRID = '#E2E8F0'; // slate-200 — griglia, deve restare sullo sfondo

const AXIS = { stroke: INK, fontSize: 11, tickLine: false, axisLine: false } as const;

function TooltipBox({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; name?: string }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-slate-900">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="mt-0.5 text-slate-600">
          {entry.name ? `${entry.name}: ` : ''}
          <span className="font-medium tabular-nums text-slate-900">{entry.value}</span>
          {unit ? ` ${unit}` : ''}
        </p>
      ))}
    </div>
  );
}

/** Barre verticali, una serie sola: il titolo del riquadro la nomina, niente legenda. */
export function MonthlyBars({
  data,
  unit,
}: {
  data: Array<{ label: string; value: number }>;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis allowDecimals={false} {...AXIS} />
        <Tooltip
          cursor={{ fill: '#F1F5F9' }}
          content={<TooltipBox unit={unit} />}
        />
        {/* Estremita' arrotondate di 4px, ancorate alla base. */}
        <Bar dataKey="value" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={34} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Linea singola. DAU, WAU e MAU stanno in tre riquadri affiancati invece che
 * in un grafico solo: hanno ordini di grandezza diversi e affastellarli su un
 * asse condiviso schiaccerebbe il DAU sulla base.
 */
export function Trend({ data }: { data: Array<{ label: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      {/* margine sinistro a zero: con un rientro negativo lo zero dell'asse
          finisce mezzo fuori dal riquadro e si legge come una parentesi. */}
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...AXIS} minTickGap={24} />
        <YAxis allowDecimals={false} {...AXIS} width={28} />
        <Tooltip content={<TooltipBox />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={SERIES[0]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#FFFFFF' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Barre orizzontali con il valore scritto accanto: l'identita' e' portata
 * dall'etichetta di riga, non dal colore. `colored` accende la palette
 * categorica dove le righe sono entita' vere (i tre piani); altrove resta una
 * tinta sola, perche' colorare passaggi di uno stesso imbuto suggerirebbe
 * differenze che non ci sono.
 */
export function HBars({
  rows,
  colored = false,
  suffix = '',
}: {
  rows: Array<{ label: string; value: number; hint?: string }>;
  colored?: boolean;
  suffix?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">Nessun dato.</p>;
  }

  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((row, i) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-700">{row.label}</span>
            <span className="tabular-nums font-medium text-slate-900">
              {row.value}
              {suffix}
              {row.hint ? <span className="ml-1.5 font-normal text-slate-400">{row.hint}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                backgroundColor: colored ? SERIES[i % SERIES.length] : SERIES[0],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tabella dei dati sotto un grafico, per chi preferisce leggere i numeri. */
export function Cells({ rows }: { rows: Array<{ label: string; value: number }> }) {
  return (
    <div className="table-scroll mt-4">
      <table className="w-full text-xs">
        <tbody>
          <tr className="border-t border-slate-100">
            {rows.map((r) => (
              <td key={r.label} className="px-2 py-1.5 text-slate-500">
                {r.label}
              </td>
            ))}
          </tr>
          <tr className="border-t border-slate-100">
            {rows.map((r) => (
              <td key={r.label} className="px-2 py-1.5 font-medium tabular-nums text-slate-900">
                {r.value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
