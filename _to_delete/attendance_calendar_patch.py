# -*- coding: utf-8 -*-
"""Pulsante 'Presenze' su tutti i tipi di allenamento e sulle sessioni di piano."""
import io, os

CANDIDATES = [
    'trainmind-app/apps/web/src/app/dashboard/calendar/page.tsx',
    'trainmind-mobile/web/src/app/dashboard/calendar/page.tsx',
]


def patch(path):
    s = io.open(path, encoding='utf-8').read()

    def sub(old, new, label, count=1):
        n = s.count(old)
        assert n == count, '%s: "%s" attese %d, trovate %d' % (path, label, count, n)
        return s.replace(old, new)

    # ── tipi che hanno il foglio presenze ───────────────────────────────
    s = sub("""/** Tipi che si possono scegliere creando un evento (`session` la assegna l'API) */
const CREATABLE_TYPES = ['gym', 'basket', 'individual', 'shooting', 'match', 'rehab', 'meeting', 'medical', 'other'];""",
            """/** Tipi che si possono scegliere creando un evento (`session` la assegna l'API) */
const CREATABLE_TYPES = ['gym', 'basket', 'individual', 'shooting', 'match', 'rehab', 'meeting', 'medical', 'other'];

/** Tipi di allenamento con foglio presenze: semafori, RPE per atleta e carico.
 *  Le sessioni della programmazione (`isSession`) lo hanno comunque. */
const ATTENDANCE_TYPES = new Set(['gym', 'basket', 'individual', 'shooting', 'rehab']);

/** true se l'evento merita il pulsante 'Presenze' */
function hasAttendance(ev: { type: string; isSession?: boolean; sessionId?: string }): boolean {
  if (ev.isSession) return Boolean(ev.sessionId);
  return ATTENDANCE_TYPES.has(ev.type);
}""",
            'ATTENDANCE_TYPES')

    # ── firme dei callback: serve sapere se l'id e' di una sessione ─────
    s = sub("  onOpenFieldTimers?: (eventId: string) => void;",
            "  onOpenFieldTimers?: (id: string, fromPlan?: boolean) => void;",
            'firma onOpenFieldTimers', count=2)

    s = sub("""              onOpenFieldTimers={(eventId) => router.push(`/dashboard/field-training/${eventId}`)}""",
            """              onOpenFieldTimers={(id, fromPlan) =>
                router.push(`/dashboard/field-training/${id}${fromPlan ? '?source=session' : ''}`)
              }""",
            'push onOpenFieldTimers', count=2)

    # ── vista lista/mese ────────────────────────────────────────────────
    s = sub("""                    {ev.type === 'basket' && !ev.isSession && onOpenFieldTimers && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenFieldTimers(ev.id); }}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-2xs font-medium text-orange-700 hover:bg-orange-200 transition-colors"
                      >
                        <Dribbble className="h-3 w-3" /> {t('exercisesShort')}
                      </button>
                    )}""",
            """                    {hasAttendance(ev) && onOpenFieldTimers && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFieldTimers(ev.isSession ? ev.sessionId! : ev.id, Boolean(ev.isSession));
                        }}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-2xs font-medium text-orange-700 hover:bg-orange-200 transition-colors"
                      >
                        <ClipboardCheck className="h-3 w-3" />
                        {ev.type === 'basket' && !ev.isSession ? t('exercisesShort') : t('attendanceShort')}
                      </button>
                    )}""",
            'bottone lista')

    # ── pannello di dettaglio ───────────────────────────────────────────
    s = sub("""        {/* Allenamento basket → presenze ed esercizi */}
        {event.type === 'basket' && !event.isSession && onOpenFieldTimers && (
          <button
            onClick={() => onOpenFieldTimers(event.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            <Dribbble className="h-4 w-4" />
            {t('fieldSession')}
          </button>
        )}""",
            """        {/* Allenamenti e sessioni di piano → foglio presenze, RPE e carico.
            Sul basket il foglio contiene anche la tabella esercizi. */}
        {hasAttendance(event) && onOpenFieldTimers && (
          <button
            onClick={() =>
              onOpenFieldTimers(event.isSession ? event.sessionId! : event.id, Boolean(event.isSession))
            }
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            {event.type === 'basket' && !event.isSession ? (
              <><Dribbble className="h-4 w-4" />{t('fieldSession')}</>
            ) : (
              <><ClipboardCheck className="h-4 w-4" />{t('attendanceSheet')}</>
            )}
          </button>
        )}""",
            'bottone dettaglio')

    # ── import icona ────────────────────────────────────────────────────
    assert 'ClipboardCheck' in s
    if 'ClipboardCheck,' not in s.split('} from \'lucide-react\';')[0]:
        head, rest = s.split("} from 'lucide-react';", 1)
        assert 'ClipboardList' in head, '%s: import lucide inatteso' % path
        head = head.replace('  ClipboardList,\n', '  ClipboardList,\n  ClipboardCheck,\n', 1)
        s = head + "} from 'lucide-react';" + rest

    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('  patched', path)


for p in CANDIDATES:
    if os.path.exists(p):
        patch(p)
    else:
        print('  skip (assente)', p)
