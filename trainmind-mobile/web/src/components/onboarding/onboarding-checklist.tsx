'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Rocket,
  X,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  label: string;
  href: string;
}

// ─── Items ───────────────────────────────────────────────

const ITEMS: ChecklistItem[] = [
  { id: 'add_athlete', label: 'Aggiungi il primo atleta', href: '/dashboard/athletes' },
  { id: 'create_plan', label: 'Crea una scheda con l\u2019AI', href: '/dashboard/chat' },
  { id: 'log_session', label: 'Registra una sessione', href: '/dashboard/training' },
  { id: 'fill_wellness', label: 'Compila il wellness', href: '/dashboard/wellness' },
  { id: 'gen_report', label: 'Genera un report', href: '/dashboard/reports' },
];

const LS_KEY = 'tm_onboarding_checklist';
const LS_DISMISSED = 'tm_onboarding_checklist_dismissed';

interface ChecklistState {
  completed: string[];
}

function loadState(): ChecklistState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { completed: [] };
}

function saveState(state: ChecklistState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// ─── Component ───────────────────────────────────────────

export function OnboardingChecklist() {
  const [state, setState] = useState<ChecklistState>({ completed: [] });
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(LS_DISMISSED) === 'true') {
        setDismissed(true);
        return;
      }
    } catch {
      // ignore
    }
    setDismissed(false);
    setState(loadState());
  }, []);

  const toggle = useCallback((id: string) => {
    setState((prev) => {
      const isCompleted = prev.completed.includes(id);
      const next: ChecklistState = {
        completed: isCompleted
          ? prev.completed.filter((c) => c !== id)
          : [...prev.completed, id],
      };
      saveState(next);
      return next;
    });
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(LS_DISMISSED, 'true');
    } catch {
      // ignore
    }
  }, []);

  if (!mounted || dismissed) return null;

  const completedCount = state.completed.length;
  const total = ITEMS.length;
  const pct = Math.round((completedCount / total) * 100);

  return (
    <div className="rounded-xl border border-teal-200 bg-white dark:bg-slate-800 shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100">
            <Rocket className="h-5 w-5 text-teal-700" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Per iniziare</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {completedCount}/{total} completati
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {/* Progress ring */}
          <div className="relative h-8 w-8">
            <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#0d9488"
                strokeWidth="3"
                strokeDasharray={`${pct} 100`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-teal-700">
              {pct}%
            </span>
          </div>

          <button
            onClick={() => setExpanded((e) => !e)}
            className="rounded p-1 text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 hover:text-slate-600 dark:text-slate-400"
            aria-label="Espandi/comprimi"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={dismiss}
            className="rounded p-1 text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 hover:text-slate-600 dark:text-slate-400"
            aria-label="Non mostrare pi\u00f9"
            title="Non mostrare pi\u00f9"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Checklist items */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3">
          <ul className="space-y-1">
            {ITEMS.map((item) => {
              const done = state.completed.includes(item.id);
              return (
                <li key={item.id} className="flex items-center gap-3">
                  <button
                    onClick={() => toggle(item.id)}
                    className="flex-shrink-0"
                    aria-label={done ? 'Segna come incompleto' : 'Segna come completo'}
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-teal-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300" />
                    )}
                  </button>
                  <Link
                    href={item.href}
                    className={`flex-1 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 ${
                      done
                        ? 'text-slate-400 dark:text-slate-500 line-through'
                        : 'font-medium text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Dismiss link */}
          <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
            <button
              onClick={dismiss}
              className="text-xs text-slate-400 dark:text-slate-500 transition-colors hover:text-slate-600 dark:text-slate-400"
            >
              Non mostrare pi\u00f9
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
