'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';

/**
 * Cerchietti dei giorni della settimana.
 *
 * Numerazione ISO: 1 = lunedi', 7 = domenica. E' la stessa che usa
 * `Date.getDay()` una volta rimappata la domenica da 0 a 7, e quella che il
 * database si aspetta nella colonna `trainingDays`.
 *
 * I nomi vengono da `Intl`, non da una tabella scritta a mano: cosi' seguono
 * la lingua dell'interfaccia e sono giusti anche dove non lo avremmo indovinato
 * (in spagnolo mercoledi' e' **X**, non M, per non confonderlo con martes).
 *
 *   it  L M M G V S D      en  M T W T F S S      es  L M X J V S D
 *
 * Le iniziali sono ambigue in tutte e tre le lingue: il nome per esteso resta
 * nel `title` e nell'`aria-label`.
 */

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Il 1° gennaio 2024 era un lunedi': serve solo come data di riferimento. */
function refDate(iso: number): Date {
  return new Date(2024, 0, iso);
}

export interface Weekday {
  iso: number;
  initial: string;
  name: string;
}

/** I sette giorni nella lingua data, da lunedi' a domenica. */
export function getWeekdays(locale: string): Weekday[] {
  const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  return ISO_DAYS.map((iso) => {
    const d = refDate(iso);
    const name = long.format(d);
    return {
      iso,
      initial: narrow.format(d).toUpperCase(),
      name: name.charAt(0).toUpperCase() + name.slice(1),
    };
  });
}

export function useWeekdays(): Weekday[] {
  const locale = useLocale();
  return useMemo(() => getWeekdays(locale), [locale]);
}

/** Nomi dei giorni scelti, in ordine, per prompt e riepiloghi. */
export function weekdayNames(days: number[], locale = 'it'): string[] {
  return getWeekdays(locale).filter((d) => days.includes(d.iso)).map((d) => d.name);
}

interface WeekdayPickerProps {
  value: number[];
  onChange?: (days: number[]) => void;
  /** Solo visualizzazione: niente click, cerchi piu' piccoli. */
  readOnly?: boolean;
  label?: string;
  hint?: string;
}

export function WeekdayPicker({ value, onChange, readOnly, label, hint }: WeekdayPickerProps) {
  const weekdays = useWeekdays();

  const toggle = (iso: number) => {
    if (readOnly || !onChange) return;
    onChange(
      value.includes(iso)
        ? value.filter((d) => d !== iso)
        : [...value, iso].sort((a, b) => a - b),
    );
  };

  const size = readOnly ? 'h-5 w-5 text-2xs' : 'h-9 w-9 text-sm';

  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="flex gap-1.5">
        {weekdays.map((d) => {
          const on = value.includes(d.iso);
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => toggle(d.iso)}
              disabled={readOnly}
              title={d.name}
              aria-label={d.name}
              aria-pressed={on}
              className={`${size} flex items-center justify-center rounded-full border font-semibold transition-colors ${
                on
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              } ${readOnly ? 'cursor-default' : 'hover:border-teal-400'}`}
            >
              {d.initial}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}
