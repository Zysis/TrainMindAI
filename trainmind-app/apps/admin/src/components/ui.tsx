import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export function Card({
  title,
  hint,
  children,
  className = '',
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    // `min-w-0` non e' decorativo: senza, una scheda usata come cella di una
    // griglia prende la larghezza minima del proprio contenuto, e una tabella
    // larga la fa debordare portandosi dietro tutta la pagina. Con questo, a
    // scorrere e' solo la tabella dentro il suo contenitore.
    <section
      className={`min-w-0 rounded-lg border border-slate-200 bg-white p-5 ${className}`}
    >
      {title ? (
        <header className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

const BADGE_TONE = {
  neutral: 'bg-slate-100 text-slate-700',
  teal: 'bg-teal-50 text-teal-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
} as const;

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONE;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function TierBadge({ tier }: { tier: string | null }) {
  const tone = tier === 'ULTRA' ? 'teal' : tier === 'PROFESSIONAL' ? 'success' : 'neutral';
  const label = tier === 'ULTRA' ? 'Ultra' : tier === 'PROFESSIONAL' ? 'Professional' : 'Starter';
  return <Badge tone={tone}>{label}</Badge>;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="table-scroll">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            {head.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-400">{children}</p>;
}

/**
 * Riquadro dichiaratamente vuoto. Lo uso dove il dato NON esiste ancora
 * (ricavi senza Stripe, sorgente prima della Fase 2): meglio dirlo che
 * mostrare uno zero che sembra un fatto.
 */
export function NotYet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-500">{title}</h2>
      <p className="mt-1.5 text-sm text-slate-500">{children}</p>
    </section>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm text-teal-700 hover:underline">
      {children}
    </Link>
  );
}
