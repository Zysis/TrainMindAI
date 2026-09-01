'use client';

import { useState, useCallback, useEffect } from 'react';
import { Sparkles, Loader2, Copy, Check, Calendar, Clock } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { WeekdayPicker, weekdayNames } from '@/components/ui/weekday-picker';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
}

interface Source {
  id: string;
  title: string;
  category: string;
  score: number;
}

interface AIExercise {
  name: string;
  category: string;
  sets: number;
  reps: string;
  intensity?: string;
  restSeconds?: number;
  notes?: string;
}

interface AISession {
  title: string;
  duration: number;
  notes?: string;
  exercises: AIExercise[];
}

interface AIWeek {
  weekNumber: number;
  notes?: string;
  sessions: AISession[];
}

export interface AIStructuredPlan {
  planName: string;
  description: string;
  weeks: AIWeek[];
}

interface AITeam {
  id: string;
  name: string;
  description?: string | null;
}

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  athletes: Athlete[];
  teams?: AITeam[];
  /** Squadra selezionata in alto nella dashboard: e' solo il valore iniziale. */
  defaultTeamId?: string | null;
  onPlanGenerated?: (
    plan: AIStructuredPlan,
    options: {
      athleteId?: string;
      teamId?: string;
      startDate?: string;
      trainingDays?: number[];
    },
  ) => void;
}

const PHASE_OPTIONS = [
  { value: 'pre-season', label: 'Pre-Season' },
  { value: 'in-season', label: 'In-Season' },
  { value: 'off-season', label: 'Off-Season' },
  { value: 'recovery', label: 'Recovery / Deload' },
];

const GOAL_OPTIONS: Array<{ value: string; labelKey?: string; label?: string; hint?: string }> = [
  // Le prime quattro voci sono le zone della curva forza-velocita': il nome
  // inglese e' quello canonico in letteratura, l'italiano quello che il coach
  // usa a voce. `hint` non si vede a schermo, va nel prompt: senza, l'AI
  // tratterebbe "Forza Esplosiva" e "Forza Reattiva" come sinonimi.
  {
    value: 'forza-massimale',
    labelKey: 'goalMaxStrength',
    hint: 'zona forza massima: carichi 85-100% 1RM, 1-5 ripetizioni, recuperi completi 3-5 minuti',
  },
  {
    value: 'forza-dinamica-massima',
    labelKey: 'goalStrengthSpeed',
    hint: 'zona forza-velocita\': carichi 70-85% 1RM mossi con intento massimale, 3-5 ripetizioni, recuperi 3 minuti',
  },
  {
    value: 'forza-esplosiva',
    labelKey: 'goalExplosivePower',
    hint: 'zona di picco della potenza meccanica: carichi 30-70% 1RM, 3-6 ripetizioni veloci, recuperi 2-3 minuti',
  },
  {
    value: 'forza-reattiva',
    labelKey: 'goalSpeedStrength',
    hint: 'zona velocita\'-forza: sovraccarichi 0-30% 1RM, pliometria e ciclo allungamento-accorciamento con tempi di contatto brevi, 3-6 ripetizioni, recuperi 2-3 minuti',
  },
  {
    value: 'ipertrofia',
    labelKey: 'goalHypertrophy',
    hint: 'carichi 65-80% 1RM, 6-12 ripetizioni, volume elevato, recuperi 60-90 secondi',
  },
  { value: 'condizionamento', labelKey: 'goalAthleticConditioning' },
  { value: 'prevenzione', labelKey: 'goalInjuryPrevention' },
  { value: 'rtp', label: 'Return to Play' },
];

const WEEKS_VALUES = [2, 4, 6, 8, 12];

export function AIGenerateModal({
  isOpen,
  onClose,
  athletes,
  teams = [],
  defaultTeamId,
  onPlanGenerated,
}: AIGenerateModalProps) {
  const t = useTranslations('ai');
  const apiError = useApiError();
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const [athleteId, setAthleteId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [planName, setPlanName] = useState('');
  const [phase, setPhase] = useState('pre-season');
  const [goal, setGoal] = useState('forza-massimale');
  const [weeks, setWeeks] = useState('4');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  // Lun/Mer/Ven: il pattern piu' comune, gia' visibile e modificabile
  // con un click. Vuoto avrebbe lasciato la scelta all'AI senza dirlo.
  const [trainingDays, setTrainingDays] = useState<number[]>([1, 3, 5]);
  const [weeksMismatch, setWeeksMismatch] = useState<{ asked: number; got: number } | null>(null);
  const [notes, setNotes] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [structuredPlan, setStructuredPlan] = useState<AIStructuredPlan | null>(null);
  const [rawContent, setRawContent] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // La squadra della dashboard e' il punto di partenza, non un vincolo:
  // se il coach ne ha gia' scelta un'altra qui, non gliela sovrascrivo.
  useEffect(() => {
    if (isOpen) setTeamId((prev) => prev || defaultTeamId || '');
  }, [isOpen, defaultTeamId]);

  const selectedAthlete = athletes.find((a) => a.id === athleteId);
  const isTeamPlan = !athleteId;
  const selectedTeam = teams.find((tm) => tm.id === teamId);
  // Un piano di squadra senza squadra non comparirebbe nell'elenco filtrato,
  // e soprattutto l'AI non saprebbe per che eta' sta programmando.
  const missingTeam = isTeamPlan && !teamId && teams.length > 0;

  const buildPrompt = useCallback(() => {
    const athleteInfo = selectedAthlete
      ? `per ${selectedAthlete.firstName} ${selectedAthlete.lastName} (${selectedAthlete.position})`
      : selectedTeam
        ? `per il gruppo squadra "${selectedTeam.name}"`
        : 'per il team';

    const phaseLabel = PHASE_OPTIONS.find((p) => p.value === phase)?.label || phase;
    const goalEntry = GOAL_OPTIONS.find((g) => g.value === goal);
    const goalLabel = goalEntry?.label ?? (goalEntry?.labelKey ? t(goalEntry.labelKey) : goal);
    const goalHint = goalEntry?.hint ? ` (${goalEntry.hint})` : '';

    const n = Number(weeks) || 4;

    let prompt = `Genera un piano di allenamento ${athleteInfo} di ESATTAMENTE ${n} settimane.\n`;
    prompt += `Fase stagionale: ${phaseLabel}.\n`;
    prompt += `Obiettivo principale: ${goalLabel}${goalHint}.\n`;
    prompt += `Il piano deve includere sessioni dettagliate con esercizi, serie, ripetizioni, intensita' e recupero.\n`;
    if (trainingDays.length > 0) {
      const names = weekdayNames(trainingDays, locale);
      prompt += `Ogni settimana ha ESATTAMENTE ${names.length} sessioni, una per ciascuno di questi giorni: ${names.join(', ')}.\n`;
      prompt += `Elenca le sessioni nello stesso ordine dei giorni e ricorda il giorno nel titolo o nelle note della sessione.\n`;
      prompt += `Distribuisci il carico tenendo conto del recupero fra un giorno e l'altro.\n`;
    } else {
      prompt += `Struttura ogni settimana con 3-4 sessioni.\n`;
    }
    prompt += `L'array "weeks" deve contenere ${n} oggetti, con "weekNumber" da 1 a ${n}.\n`;
    prompt += `I carichi devono progredire di settimana in settimana.\n`;

    // Il nome del gruppo porta con se' l'eta' ("Under 14", "Prima Squadra"):
    // senza dirlo, l'AI scrive lo stesso piano per un ragazzino e un senior.
    if (!selectedAthlete && selectedTeam) {
      prompt += `Destinatari: gruppo squadra "${selectedTeam.name}"`;
      if (selectedTeam.description?.trim()) {
        prompt += ` (${selectedTeam.description.trim()})`;
      }
      prompt += `.\n`;
      prompt += `Adatta volumi, carichi, complessita' tecnica e densita' del lavoro all'eta' e al livello di maturazione di questo gruppo: un Under 14 e un Under 18 non si allenano allo stesso modo.\n`;
    }

    if (planName.trim()) {
      prompt += `Il piano si chiama "${planName.trim()}": usa esattamente questo testo come "planName".\n`;
    }

    if (notes.trim()) {
      prompt += `\nNote aggiuntive del coach: ${notes.trim()}\n`;
    }

    // Ripetuto in chiusura: e' la posizione che il modello segue meglio.
    prompt += `\nRICORDA: il piano deve avere ${n} settimane complete, non una sola.`;

    return prompt;
  }, [selectedAthlete, selectedTeam, planName, phase, goal, weeks, trainingDays, notes, t, locale]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setStructuredPlan(null);
    setRawContent('');
    setSources([]);
    setWeeksMismatch(null);

    try {
      const res = await apiFetch<{ success: boolean; data: { content: string; structured_plan?: AIStructuredPlan; sources: Source[] } }>('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: buildPrompt(),
          athlete_id: athleteId || undefined,
          context_type: 'plan',
          top_k: 5,
          expected_weeks: Number(weeks) || 4,
        }),
      });
      const payload = res.data ?? (res as unknown as { content: string; structured_plan?: AIStructuredPlan; sources: Source[] });
      setRawContent(payload.content || '');
      setSources(payload.sources || []);

      if (payload.structured_plan) {
        setStructuredPlan(payload.structured_plan);
        // Se il coach non ha dato un nome, quello proposto dall'AI riempie il
        // campo: resta modificabile prima di salvare.
        setPlanName((prev) => prev.trim() || payload.structured_plan?.planName || '');
        // Se l'AI non rispetta la durata chiesta va detto, non scoperto dopo
        const asked = Number(weeks) || 4;
        const got = payload.structured_plan.weeks?.length ?? 0;
        if (got > 0 && got !== asked) {
          setWeeksMismatch({ asked, got });
        } else {
          setWeeksMismatch(null);
        }
      }
    } catch (err) {
      setError(apiError(err, 'Errore sconosciuto'));
    } finally {
      setIsGenerating(false);
    }
  }, [buildPrompt, athleteId]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(rawContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [rawContent]);

  const handleAccept = useCallback(() => {
    if (onPlanGenerated && structuredPlan) {
      const named = planName.trim()
        ? { ...structuredPlan, planName: planName.trim() }
        : structuredPlan;
      onPlanGenerated(named, {
        athleteId: athleteId || undefined,
        teamId: teamId || undefined,
        startDate: startDate || undefined,
        trainingDays,
      });
    }
    onClose();
  }, [structuredPlan, athleteId, teamId, planName, startDate, trainingDays, onPlanGenerated, onClose]);

  const handleReset = () => {
    setStructuredPlan(null);
    setRawContent('');
    setSources([]);
    setWeeksMismatch(null);
    setError(null);
  };

  const hasContent = structuredPlan || rawContent;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t('generateModalTitle')}
      size="lg"
    >
      <div className="space-y-4">
        {/* Configuration form (shown before generation) */}
        {!hasContent && !isGenerating && (
          <>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <p className="text-sm font-medium text-teal-800">{t('generationBannerTitle')}</p>
              </div>
              <p className="mt-1 text-xs text-teal-600">{t('generationBannerBody')}</p>
            </div>

            <Input
              label={t('planNameLabel')}
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder={t('planNamePlaceholder')}
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t('athleteLabel')}
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
                options={[
                  { value: '', label: t('teamPlan') },
                  ...athletes.map((a) => ({
                    value: a.id,
                    label: `${a.firstName} ${a.lastName} (${a.position})`,
                  })),
                ]}
              />
              <Select
                label={t('seasonPhase')}
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                options={PHASE_OPTIONS}
              />
            </div>

            {/* Solo per i piani di squadra: e' li' che serve sapere quale */}
            {isTeamPlan && (
              <div>
                <Select
                  label={`${t('teamLabel')} *`}
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  options={[
                    { value: '', label: t('teamPlaceholder') },
                    ...teams.map((tm) => ({ value: tm.id, label: tm.name })),
                  ]}
                />
                <p className={`mt-1 text-xs ${missingTeam ? 'text-amber-600' : 'text-slate-400 dark:text-slate-500'}`}>
                  {missingTeam ? t('teamRequired') : t('teamHint')}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t('goalLabel')}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                options={GOAL_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.labelKey ? t(o.labelKey) : (o.label ?? o.value),
                }))}
              />
              <Select
                label={`${t('durationLabel')} *`}
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                options={WEEKS_VALUES.map((n) => ({ value: String(n), label: t('nWeeks', { n }) }))}
              />
            </div>

            <Input
              label={`${t('startDateLabel')} *`}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              hint={trainingDays.length > 0 ? t('startDateHint') : undefined}
            />

            <WeekdayPicker
              label={t('trainingDaysLabel')}
              value={trainingDays}
              onChange={setTrainingDays}
              hint={
                trainingDays.length > 0
                  ? t('trainingDaysCount', { n: trainingDays.length })
                  : t('trainingDaysEmpty')
              }
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t('notesOptionalLabel')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
                rows={2}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-500 focus:border-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-300"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || missingTeam}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {t('generateAction')}
              </button>
            </div>
          </>
        )}

        {/* Loading state */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            <p className="mt-3 text-sm font-medium text-slate-700">{t('generatingTitle')}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t('generatingBody')}</p>
          </div>
        )}

        {/* Generated content — structured view */}
        {hasContent && !isGenerating && (
          <>
            <div className="flex items-end justify-between gap-3">
              {structuredPlan ? (
                <div className="flex-1">
                  <Input
                    label={t('planNameLabel')}
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder={structuredPlan.planName}
                  />
                </div>
              ) : (
                <p className="text-sm font-semibold text-slate-700">{t('generatedPlan')}</p>
              )}
              <div className="flex items-center gap-2 pb-1">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
                >
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? tCommon('copied') : tCommon('copy')}
                </button>
              </div>
            </div>

            {weeksMismatch && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                {t('weeksMismatch', { asked: weeksMismatch.asked, got: weeksMismatch.got })}
              </div>
            )}

            {structuredPlan && (
              <p className="text-sm text-slate-600 dark:text-slate-400">{structuredPlan.description}</p>
            )}

            <div className="max-h-[400px] space-y-3 overflow-y-auto">
              {structuredPlan ? (
                /* Structured preview */
                structuredPlan.weeks.map((week) => (
                  <div key={week.weekNumber} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-4 py-2.5">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Settimana {week.weekNumber}
                      </h4>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {week.sessions.length} sessioni
                      </span>
                    </div>
                    {week.notes && (
                      <p className="border-b border-slate-50 px-4 py-2 text-xs text-slate-500 dark:text-slate-400 italic">
                        {week.notes}
                      </p>
                    )}
                    <div className="divide-y divide-slate-50">
                      {week.sessions.map((session, si) => (
                        <div key={si} className="px-4 py-3">
                          <div className="mb-2 flex items-center gap-3">
                            <span className="flex items-center gap-1 text-sm font-semibold text-teal-700">
                              <Calendar className="h-3.5 w-3.5" />
                              {session.title}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                              <Clock className="h-3 w-3" />
                              {session.duration} min
                            </span>
                          </div>
                          {session.notes && (
                            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400 italic">{session.notes}</p>
                          )}
                          {session.exercises && session.exercises.length > 0 && (
                            <div className="space-y-1">
                              {session.exercises.map((ex, ei) => (
                                <div key={ei} className="flex items-baseline gap-2 text-xs">
                                  <span className="w-5 flex-shrink-0 text-right font-medium text-slate-400 dark:text-slate-500">
                                    {ei + 1}.
                                  </span>
                                  <span className="font-medium text-slate-700">{ex.name}</span>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    {ex.sets}x{ex.reps}
                                    {ex.intensity && ` @ ${ex.intensity}`}
                                  </span>
                                  {ex.restSeconds && (
                                    <span className="text-slate-400 dark:text-slate-500">
                                      Rec: {ex.restSeconds >= 60 ? `${Math.round(ex.restSeconds / 60)} min` : `${ex.restSeconds}s`}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                /* Fallback: raw text */
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans">{rawContent}</pre>
                </div>
              )}
            </div>

            {sources.length > 0 && (
              <div className="rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  {t('sourcesFromKb', { n: sources.length })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sources.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-2xs text-slate-600 dark:text-slate-400"
                    >
                      {s.title} ({Math.round(s.score * 100)}%)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                onClick={handleReset}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
              >
                {t('regenerate')}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
                >
                  {tCommon('close')}
                </button>
                <button
                  onClick={handleAccept}
                  disabled={!structuredPlan}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {t('usePlan')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
