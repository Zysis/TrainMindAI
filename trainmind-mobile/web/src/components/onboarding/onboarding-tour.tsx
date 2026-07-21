'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────

interface TourStep {
  selector?: string;
  title: string;
  description: string;
}

// ─── Steps ───────────────────────────────────────────────

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="sidebar"]',
    title: 'Navigazione',
    description:
      'Usa la barra laterale per accedere a tutte le sezioni dell\u2019app',
  },
  {
    selector: '[data-tour="stat-cards"]',
    title: 'Dashboard',
    description:
      'Qui trovi una panoramica dei tuoi atleti, sessioni e metriche chiave',
  },
  {
    selector: '[data-tour="nav-athletes"]',
    title: 'Atleti',
    description:
      'Gestisci il tuo roster: aggiungi atleti, monitora infortuni e wellness',
  },
  {
    selector: '[data-tour="nav-chat"]',
    title: 'Chat AI',
    description:
      'Parla con l\u2019AI per generare schede, chiedere consigli e adattare i programmi',
  },
  {
    selector: '[data-tour="nav-training"]',
    title: 'Schede',
    description:
      'Crea e gestisci i piani di allenamento per ogni atleta',
  },
  {
    selector: '[data-tour="nav-reports"]',
    title: 'Report',
    description:
      'Genera report automatici per staff tecnico, medico e preparatore',
  },
  {
    title: 'Tutto pronto!',
    description:
      'Inizia aggiungendo il tuo primo atleta o chatta con l\u2019AI per creare una scheda di allenamento.',
  },
];

const LS_KEY = 'tm_onboarding_complete';

// ─── Component ───────────────────────────────────────────

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Only run on mount (client)
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY) !== 'true') {
        // Small delay so sidebar DOM is ready
        const t = setTimeout(() => setActive(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Highlight the target element for the current step
  const highlight = useCallback(() => {
    const currentStep = TOUR_STEPS[step];
    if (!currentStep?.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(currentStep.selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      // Wait for scroll to finish
      const t = setTimeout(() => {
        setRect(el.getBoundingClientRect());
      }, 350);
      return () => clearTimeout(t);
    } else {
      setRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!active) return;
    const cleanup = highlight();
    // Re-measure on resize / scroll
    const onResize = () => highlight();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cleanup?.();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [active, step, highlight]);

  const finish = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(LS_KEY, 'true');
    } catch {
      // ignore
    }
  }, []);

  const next = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }, [step, finish]);

  if (!active) return null;

  const currentStep = TOUR_STEPS[step];
  const isFinal = !currentStep.selector;
  const padding = 6;

  // Cutout coordinates (if we have a target rect)
  const cutout = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  // Tooltip position — place near the cutout
  const tooltipStyle: React.CSSProperties = isFinal
    ? {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    : cutout
      ? (() => {
          const spaceRight = window.innerWidth - (cutout.left + cutout.width);
          const spaceBelow = window.innerHeight - (cutout.top + cutout.height);

          // Prefer right side of the element
          if (spaceRight > 340) {
            return {
              top: Math.max(16, Math.min(cutout.top, window.innerHeight - 240)),
              left: cutout.left + cutout.width + 16,
            } as React.CSSProperties;
          }
          // Then below
          if (spaceBelow > 200) {
            return {
              top: cutout.top + cutout.height + 16,
              left: Math.max(16, cutout.left),
            } as React.CSSProperties;
          }
          // Fallback: above
          return {
            top: Math.max(16, cutout.top - 200),
            left: Math.max(16, cutout.left),
          } as React.CSSProperties;
        })()
      : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop SVG with cutout */}
      <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {cutout && (
              <rect
                x={cutout.left}
                y={cutout.top}
                width={cutout.width}
                height={cutout.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.6)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: 'auto' }}
        />
      </svg>

      {/* Spotlight ring */}
      {cutout && (
        <div
          className="absolute rounded-lg ring-2 ring-teal-400 ring-offset-2 transition-all duration-300"
          style={{
            top: cutout.top,
            left: cutout.left,
            width: cutout.width,
            height: cutout.height,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute w-80 rounded-xl bg-white dark:bg-slate-800 p-5 shadow-2xl transition-all duration-300"
        style={tooltipStyle}
      >
        {/* Step counter */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-teal-600">
            {step + 1}/{TOUR_STEPS.length}
          </span>
          <button
            onClick={finish}
            className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 transition-colors hover:text-slate-600 dark:text-slate-400"
            aria-label="Salta Tour"
          >
            <X className="h-3.5 w-3.5" />
            Salta Tour
          </button>
        </div>

        {/* Content */}
        <h3 className="mb-1.5 text-base font-bold text-slate-900 dark:text-white">
          {currentStep.title}
        </h3>
        <p className="mb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {currentStep.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 hover:text-slate-700"
            >
              Indietro
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={next}
            className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-700 active:scale-95"
          >
            {isFinal ? 'Inizia!' : 'Avanti'}
          </button>
        </div>

        {/* Progress dots */}
        <div className="mt-4 flex justify-center gap-1.5">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? 'w-4 bg-teal-600'
                  : i < step
                    ? 'w-1.5 bg-teal-300'
                    : 'w-1.5 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
