# -*- coding: utf-8 -*-
"""Nuovi tipi evento del calendario, icona basket, Rehab collegato all'RTP."""
import io

FILES = [
    'trainmind-app/apps/web/src/app/dashboard/calendar/page.tsx',
    'trainmind-mobile/web/src/app/dashboard/calendar/page.tsx',
]


def patch(path):
    raw = io.open(path, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = raw.replace('\r\n', '\n') if crlf else raw

    def sub(old, new, label, count=1):
        nonlocal s
        found = s.count(old)
        assert found == count, '%s: ancora "%s" trovata %d volte (attese %d)' % (path, label, found, count)
        s = s.replace(old, new)

    # ── 1. icone ────────────────────────────────────────────
    sub("""import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  Dumbbell,
  Swords,
  Stethoscope,
  Users,
  CalendarDays,
  Trash2,
  CircleDot,
  ExternalLink,
  Layers,
  Timer,
} from 'lucide-react';""",
        """import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  Dumbbell,
  Dribbble,
  User,
  Target,
  Swords,
  HeartPulse,
  Stethoscope,
  Users,
  CalendarDays,
  Trash2,
  ClipboardList,
  ExternalLink,
  Layers,
} from 'lucide-react';""",
        'import icone')

    # ── 2. mappa dei tipi ───────────────────────────────────
    sub("""const EVENT_TYPE_STYLES: Record<string, { labelKey: string; color: string; bg: string; icon: typeof Dumbbell }> = {
  training: { labelKey: 'training', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200', icon: Dumbbell },
  field_training: { labelKey: 'fieldTraining', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: CircleDot },
  match: { labelKey: 'match', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Swords },
  medical: { labelKey: 'medical', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: Stethoscope },
  meeting: { labelKey: 'meeting', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Users },
  other: { labelKey: 'other', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 border-slate-200 dark:border-slate-700', icon: CalendarDays },
};""",
        """const EVENT_TYPE_STYLES: Record<string, { labelKey: string; color: string; bg: string; icon: typeof Dumbbell }> = {
  gym: { labelKey: 'typeGym', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200', icon: Dumbbell },
  basket: { labelKey: 'typeBasket', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: Dribbble },
  individual: { labelKey: 'typeIndividual', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', icon: User },
  shooting: { labelKey: 'typeShooting', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Target },
  match: { labelKey: 'typeMatch', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Swords },
  rehab: { labelKey: 'typeRehab', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: HeartPulse },
  meeting: { labelKey: 'typeMeeting', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Users },
  medical: { labelKey: 'typeMedical', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: Stethoscope },
  other: { labelKey: 'typeOther', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 border-slate-200 dark:border-slate-700', icon: CalendarDays },
  // Non selezionabile a mano: l'API marca così le sessioni dei piani di allenamento
  session: { labelKey: 'typeSession', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: Layers },
};

/** Tipi che si possono scegliere creando un evento (`session` la assegna l'API) */
const CREATABLE_TYPES = ['gym', 'basket', 'individual', 'shooting', 'match', 'rehab', 'meeting', 'medical', 'other'];

/** Ordine delle fasi del protocollo Return To Play, come nell'API */
const RTP_PHASE_ORDER = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5', 'CLEARED'];

interface RtpProtocolInfo {
  protocolId: string;
  athleteId: string;
  athleteName: string;
  phase: string;
}

interface RtpApiProtocol {
  id: string;
  currentPhase: string;
  athlete: { id: string; firstName: string; lastName: string };
}

/** Protocolli RTP attivi, usati dagli eventi di tipo Rehab */
async function fetchActiveRtp(): Promise<RtpProtocolInfo[]> {
  try {
    const res = await apiFetch<{ data: { protocols: RtpApiProtocol[] } }>('/rtp');
    return (res.data?.protocols || []).map((p) => ({
      protocolId: p.id,
      athleteId: p.athlete.id,
      athleteName: `${p.athlete.lastName} ${p.athlete.firstName}`,
      phase: p.currentPhase,
    }));
  } catch {
    return [];
  }
}""",
        'EVENT_TYPE_STYLES')

    # ── 3. tipo dell'evento nell'interfaccia ────────────────
    sub("""  isSession?: boolean;
  sessionId?: string;""",
        """  isSession?: boolean;
  sessionId?: string;
  athleteId?: string | null;
  athleteName?: string | null;""",
        'interface CalendarEvent')

    # ── 4. pulsante nella cella del giorno ──────────────────
    sub("""                    {ev.type === 'field_training' && !ev.isSession && onOpenFieldTimers && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenFieldTimers(ev.id); }}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-2xs font-medium text-orange-700 hover:bg-orange-200 transition-colors"
                      >
                        <Timer className="h-3 w-3" /> {t('timers')}
                      </button>
                    )}
                    {ev.type === 'match' && !ev.isSession && onOpenGameTracking && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenGameTracking(ev.id); }}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-2xs font-medium text-purple-700 hover:bg-purple-200 transition-colors"
                      >
                        <Timer className="h-3 w-3" /> {t('gameMinutes')}
                      </button>
                    )}""",
        """                    {ev.type === 'basket' && !ev.isSession && onOpenFieldTimers && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenFieldTimers(ev.id); }}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-2xs font-medium text-orange-700 hover:bg-orange-200 transition-colors"
                      >
                        <Dribbble className="h-3 w-3" /> {t('exercisesShort')}
                      </button>
                    )}
                    {ev.type === 'match' && !ev.isSession && onOpenGameTracking && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenGameTracking(ev.id); }}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-2xs font-medium text-purple-700 hover:bg-purple-200 transition-colors"
                      >
                        <ClipboardList className="h-3 w-3" /> {t('gameMinutes')}
                      </button>
                    )}""",
        'pulsanti cella giorno')

    # ── 5. pulsanti nel pannello di dettaglio ───────────────
    sub("""        {/* Field training → Cronometri button */}
        {event.type === 'field_training' && !event.isSession && onOpenFieldTimers && (
          <button
            onClick={() => onOpenFieldTimers(event.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            <Timer className="h-4 w-4" />
            {t('trainingTimers')}
          </button>
        )}

        {/* Match → Game tracking button */}
        {event.type === 'match' && !event.isSession && onOpenGameTracking && (
          <button
            onClick={() => onOpenGameTracking(event.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            <Timer className="h-4 w-4" />
            {t('gameMinutes')}
          </button>
        )}""",
        """        {/* Allenamento basket → presenze ed esercizi */}
        {event.type === 'basket' && !event.isSession && onOpenFieldTimers && (
          <button
            onClick={() => onOpenFieldTimers(event.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            <Dribbble className="h-4 w-4" />
            {t('fieldSession')}
          </button>
        )}

        {/* Rehab → protocollo Return To Play */}
        {event.type === 'rehab' && !event.isSession && rtp && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-medium text-rose-700">{t('rtpProtocol')}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{rtp.athleteName}</p>
            <p className="mt-0.5 text-xs text-slate-600">{phaseLabel(rtp.phase)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {nextPhase && (
                <button
                  onClick={advancePhase}
                  disabled={advancing}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {tInjuries('advancePhase')}
                </button>
              )}
              <button
                onClick={() => router.push('/dashboard/injuries')}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                <ExternalLink className="h-3 w-3" />
                {t('openInjuryCard')}
              </button>
            </div>
          </div>
        )}

        {/* Match → Game tracking button */}
        {event.type === 'match' && !event.isSession && onOpenGameTracking && (
          <button
            onClick={() => onOpenGameTracking(event.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            <ClipboardList className="h-4 w-4" />
            {t('gameMinutes')}
          </button>
        )}""",
        'pulsanti dettaglio')

    # ── 6. stato RTP nel pannello di dettaglio ──────────────
    sub("""  const t = useTranslations('calendar');
  const locale = useLocale();
  const eventTypeConfig = useEventTypeConfig(t);
  const cfg = eventTypeConfig[event.type] || eventTypeConfig.other;

  return (""",
        """  const t = useTranslations('calendar');
  const tInjuries = useTranslations('injuries');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const eventTypeConfig = useEventTypeConfig(t);
  const cfg = eventTypeConfig[event.type] || eventTypeConfig.other;

  // ─── Rehab: protocollo RTP dell'atleta collegato ───────
  const [rtp, setRtp] = useState<RtpProtocolInfo | null>(null);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (event.type !== 'rehab' || !event.athleteId) {
      setRtp(null);
      return;
    }
    let cancelled = false;
    fetchActiveRtp().then((list) => {
      if (cancelled) return;
      setRtp(list.find((p) => p.athleteId === event.athleteId) || null);
    });
    return () => { cancelled = true; };
  }, [event.type, event.athleteId]);

  const phaseLabel = (phase: string) => {
    const idx = RTP_PHASE_ORDER.indexOf(phase);
    if (phase === 'CLEARED') return t('rtpCleared');
    return idx >= 0 ? tInjuries(`phase${idx + 1}Label`) : phase;
  };

  const nextPhase = rtp ? RTP_PHASE_ORDER[RTP_PHASE_ORDER.indexOf(rtp.phase) + 1] : undefined;

  const advancePhase = async () => {
    if (!rtp || !nextPhase) return;
    setAdvancing(true);
    try {
      await apiFetch(`/rtp/${rtp.protocolId}/advance`, {
        method: 'POST',
        body: JSON.stringify({ targetPhase: nextPhase }),
      });
      setRtp({ ...rtp, phase: nextPhase });
      toast('success', tInjuries('phaseAdvanced'));
    } catch (err) {
      // 422 quando i criteri della fase corrente non sono soddisfatti:
      // il messaggio dell'API dice quanti ne mancano.
      toast('error', err instanceof Error ? err.message : tInjuries('advancePhase'));
    } finally {
      setAdvancing(false);
    }
  };

  return (""",
        'stato RTP nel dettaglio')

    # ── 7. menu dei tipi nel modale di creazione ────────────
    sub("""                {Object.entries(eventTypeConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}""",
        """                {CREATABLE_TYPES.map((k) => (
                  <option key={k} value={k}>{eventTypeConfig[k]?.label || k}</option>
                ))}""",
        'select tipi')

    # ── 8. Rehab nel modale di creazione: scelta atleta ─────
    sub("""  const [type, setType] = useState('other');
  const [teamId, setTeamId] = useState(selectedTeamId || '');""",
        """  const [type, setType] = useState('other');
  const [teamId, setTeamId] = useState(selectedTeamId || '');
  const [athleteId, setAthleteId] = useState('');
  const [rtpList, setRtpList] = useState<RtpProtocolInfo[]>([]);""",
        'stato modale')

    sub("""  const handleSubmit = async () => {
    if (!title.trim()) return;""",
        """  // Gli eventi Rehab si agganciano a un atleta con protocollo RTP attivo
  useEffect(() => {
    if (type !== 'rehab' || rtpList.length > 0) return;
    let cancelled = false;
    fetchActiveRtp().then((list) => { if (!cancelled) setRtpList(list); });
    return () => { cancelled = true; };
  }, [type, rtpList.length]);

  const handleSubmit = async () => {
    if (!title.trim()) return;""",
        'effetto rtp modale')

    sub("""          allDay,
          teamId: teamId || undefined,
        }),""",
        """          allDay,
          teamId: teamId || undefined,
          athleteId: type === 'rehab' && athleteId ? athleteId : undefined,
        }),""",
        'body creazione')

    sub("""            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('teamLabel')}</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}""",
        """            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('teamLabel')}</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}""",
        'squadra (invariata)')

    # inserisce il select atleta subito dopo il blocco tipo/squadra
    sub("""                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>{tm.name}</option>
                ))}
              </select>
            </div>
          </div>
""",
        """                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>{tm.name}</option>
                ))}
              </select>
            </div>
          </div>

          {type === 'rehab' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('injuredAthlete')}</label>
              <select
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              >
                <option value="">{t('noAthlete')}</option>
                {rtpList.map((p) => (
                  <option key={p.athleteId} value={p.athleteId}>{p.athleteName}</option>
                ))}
              </select>
              {rtpList.length === 0 && (
                <p className="mt-1 text-2xs text-slate-400">{t('noActiveRtp')}</p>
              )}
            </div>
          )}
""",
        'select atleta rehab')

    out = s.replace('\n', '\r\n') if crlf else s
    io.open(path, 'w', encoding='utf-8', newline='').write(out)
    print('patched', path)


for f in FILES:
    patch(f)
