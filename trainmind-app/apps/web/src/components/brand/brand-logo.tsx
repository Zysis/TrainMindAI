import { useId, type SVGProps } from 'react';
import type { PlanKey } from './plan';

/**
 * BrandLogo — basket "mono teal" di TrainMind.
 *
 * Geometria: cerchio + cucitura verticale + cucitura orizzontale + due archi
 * laterali, il tutto clippato al cerchio.
 *
 * Toni:
 * - `light` → palla teal-600 + cuciture teal-950 (per sfondi chiari)
 * - `dark`  → palla teal-400 + cuciture teal-700 (per sfondi scuri)
 *
 * Nota sul piano: il prop `plan` è accettato ma volutamente non rende
 * decorazioni grafiche sull'icona — la differenziazione visiva del piano
 * (START · PRO · ULTRA) avviene tramite la pill amber accanto al wordmark
 * in sidebar, il badge in topbar e la card "Piano corrente" in Impostazioni.
 */

type Tone = 'light' | 'dark';

const PALETTES: Record<Tone, { ball: string; seam: string }> = {
  light: { ball: '#0D9488', seam: '#042F2E' },
  dark: { ball: '#2DD4BF', seam: '#0F766E' },
};

export interface BrandLogoProps extends SVGProps<SVGSVGElement> {
  tone?: Tone;
  /** Accettato per compatibilità coi call site — non altera la grafica. */
  plan?: PlanKey | null;
}

export function BrandLogo({
  tone = 'light',
  // `plan` resta nella firma ma non è usato nel render
  plan: _plan = null,
  className = 'h-9 w-9',
  ...rest
}: BrandLogoProps) {
  const id = useId();
  const clipId = `tmLogoClip-${id}`;
  const palette = PALETTES[tone];

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...rest}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="12" cy="12" r="10" />
        </clipPath>
      </defs>

      {/* Palla */}
      <circle cx="12" cy="12" r="10" fill={palette.ball} />

      {/* Cuciture (clippate al cerchio) */}
      <g
        fill="none"
        stroke={palette.seam}
        strokeWidth="1.5"
        strokeLinecap="round"
        clipPath={`url(#${clipId})`}
      >
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M 3 5 Q 10 12 3 19" />
        <path d="M 21 5 Q 14 12 21 19" />
      </g>
    </svg>
  );
}
