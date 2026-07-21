'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Loader2, Copy, Check, Calendar, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/auth/fetch';

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

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  athletes: Athlete[];
  onPlanGenerated?: (plan: AIStructuredPlan, athleteId?: string) => void;
}

const PHASE_OPTIONS = [
  { value: 'pre-season', label: 'Pre-Season' },
  { value: 'in-season', label: 'In-Season' },
  { value: 'off-season', label: 'Off-Season' },
  { value: 'recovery', label: 'Recovery / Deload' },
];

const GOAL_OPTIONS = [
  { value: 'forza-massimale', labelKey: 'goalMaxStrength' },
  { value: 'potenza', labelKey: 'goalExplosivePower' },
  { value: 'ipertrofia', labelKey: 'goalFunctionalHypertrophy' },
  { value: 'condizionamento', labelKey: 'goalAthleticConditioning' },
  { value: 'prevenzione', labelKey: 'goalInjuryPrevention' },
  { value: 'rtp', label: 'Return to Play' },
];

const WEEKS_OPTIONS = [
  { value: '2', label: '2 settimane' },
  { value: '4', label: '4 settimane' },
  { value: '6', label: '6 settimane' },
  { value: '8', label: '8 settimane' },
  { value: '12', label: '12 settimane' },
];

export function AIGenerateModal({ isOpen, onClose, athletes, onPlanGenerated }: AIGenerateModalProps) {
  const t = useTranslations('ai');
  const [athleteId, setAthleteId] = useState('');
  const [phase, setPhase] = useState('pre-season');
  const [goal, setGoal] = useState('forza-massimale');
  const [weeks, setWeeks] = useState('4');
  const [notes, setNotes] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [structuredPlan, setStructuredPlan] = useState<AIStructuredPlan | null>(null);
  const [rawContent, setRawContent] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedAthlete = athletes.find((a) => a.id === athleteId);

  const buildPrompt = useCallback(() => {
    const athleteInfo = selectedAthlete
      ? `per ${selectedAthlete.firstName} ${selectedAthlete.lastName} (${selectedAthlete.position})`
      : 'per il team';

    const phaseLabel = PHASE_OPTIONS.find((p) => p.value === phase)?.label || phase;
    const goalLabel = GOAL_OPTIONS.find((g) => g.value === goal)?.label || goal;

    let prompt = `Genera un piano di allenamento ${athleteInfo} di ${weeks} settimane.\n`;
    prompt += `Fase stagionale: ${phaseLabel}.\n`;
    prompt += `Obiettivo principale: ${goalLabel}.\n`;
    prompt += `Il piano deve includere sessioni dettagliate con esercizi, serie, ripetizioni, intensita' e recupero.\n`;
    prompt += `Struttura ogni settimana con 3-4 sessioni.\n`;

    if (notes.trim()) {
      prompt += `\nNote aggiuntive del coach: ${notes.trim()}`;
    }

    return prompt;
  }, [selectedAthlete, phase, goal, weeks, notes]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setStructuredPlan(null);
    setRawContent('');
    setSources([]);

    try {
      const res = await apiFetch<{ success: boolean; data: { content: string; structured_plan?: AIStructuredPlan; sources: Source[] } }>('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: buildPrompt(),
          athlete_id: athleteId || undefined,
          context_type: 'plan',
          top_k: 5,
        }),
      });
      const payload = res.data ?? (res as unknown as { content: string; structured_plan?: AIStructuredPlan; sources: Source[] });
      setRawContent(payload.content || '');
      setSources(payload.sources || []);

      if (payload.structured_plan) {
        setStructuredPlan(payload.structured_plan);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
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
      onPlanGenerated(structuredPlan, athleteId || undefined);
    }
    onClose();
  }, [structuredPlan, athleteId, onPlanGenerated, onClose]);

  const handleReset = () => {
    setStructuredPlan(null);
    setRawContent('');
    setSources([]);
    setError(null);
  };

  const hasContent = structuredPlan || rawContent;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Genera Piano con AI"
      size="lg"
    >
      <div className="space-y-4">
        {/* Configuration form (shown before generation) */}
        {!hasContent && !isGenerating && (
          <>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <p className="text-sm font-medium text-teal-800">Generazione AI</p>
              </div>
              <p className="mt-1 text-xs text-teal-600">
                L&apos;AI generera&apos; un piano strutturato con settimane e sessioni,
                pronto per essere aggiunto direttamente ai tuoi allenamenti.
              </p>
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t('goalLabel')}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                options={GOAL_OPTIONS}
              />
              <Select
                label={t('durationLabel')}
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                options={WEEKS_OPTIONS}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Note aggiuntive (opzionale)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Es. Atleta reduce da distorsione caviglia dx, evitare salti..."
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
                Annulla
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Genera Piano
              </button>
            </div>
          </>
        )}

        {/* Loading state */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            <p className="mt-3 text-sm font-medium text-slate-700">Generazione in corso...</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">L&apos;AI sta creando il piano strutturato</p>
          </div>
        )}

        {/* Generated content — structured view */}
        {hasContent && !isGenerating && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">
                {structuredPlan ? structuredPlan.planName : 'Piano generato'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
                >
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copiato' : 'Copia'}
                </button>
              </div>
            </div>

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
                  Fonti dalla knowledge base ({sources.length})
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
                Rigenera
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
                >
                  Chiudi
                </button>
                <button
                  onClick={handleAccept}
                  disabled={!structuredPlan}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  Usa questo piano
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
