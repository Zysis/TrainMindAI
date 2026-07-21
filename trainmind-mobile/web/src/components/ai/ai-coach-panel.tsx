'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

interface Source {
  id: string;
  title: string;
  category: string;
  score: number;
}

interface AICoachPanelProps {
  /** Pre-fill the question with context, e.g. exercise name */
  initialContext?: string;
  /** Category hint for the AI */
  category?: string;
  /** Compact mode for embedding in sidebars */
  compact?: boolean;
}

const QUICK_QUESTIONS = [
  'Quali esercizi consigli per prevenire infortuni al ginocchio?',
  'Come strutturare una progressione di forza per il basket?',
  'Quali sono le migliori alternative al back squat?',
  'Come integrare il lavoro pliometrico nel programma settimanale?',
];

export function AICoachPanel({ initialContext, category, compact = false }: AICoachPanelProps) {
  const t = useTranslations('ai');
  const [question, setQuestion] = useState(initialContext || '');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);

  const askCoach = useCallback(async (q: string) => {
    if (!q.trim()) return;

    setIsLoading(true);
    setError(null);
    setAnswer('');
    setSources([]);

    try {
      const res = await apiFetch<{ success: boolean; data: { answer?: string; content?: string; sources?: Source[] } }>('/ai/coach', {
        method: 'POST',
        body: JSON.stringify({
          question: q.trim(),
          category: category || undefined,
          namespaces: ['exercises', 'protocols', 'references'],
          top_k: 5,
        }),
      });
      const payload = res.data ?? (res as unknown as { answer?: string; content?: string; sources?: Source[] });
      setAnswer(payload.answer || payload.content || '');
      setSources(payload.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askCoach(question);
  };

  const handleQuickQuestion = (q: string) => {
    setQuestion(q);
    askCoach(q);
  };

  if (compact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-medium text-teal-700 hover:bg-teal-100"
      >
        <Sparkles className="h-4 w-4" />
        Chiedi al Coach AI
        <ChevronDown className="ml-auto h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-teal-200 bg-white dark:bg-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-teal-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-600" />
          <span className="text-sm font-semibold text-teal-800">Coach AI</span>
        </div>
        {compact && (
          <button onClick={() => setIsExpanded(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400">
            <ChevronUp className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Quick questions (only when no answer yet) */}
        {!answer && !isLoading && (
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Domande suggerite:</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickQuestion(q)}
                  className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                >
                  {q.length > 50 ? q.slice(0, 50) + '...' : q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('coachPlaceholder')}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-500 focus:border-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-300"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Il Coach AI sta analizzando...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Answer */}
        {answer && !isLoading && (
          <div className="space-y-3">
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
              <MarkdownRenderer content={answer} />
            </div>

            {sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-2xs text-slate-400 dark:text-slate-500">Fonti:</span>
                {sources.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-2xs text-slate-500 dark:text-slate-400"
                  >
                    {s.title} ({Math.round(s.score * 100)}%)
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={() => { setAnswer(''); setSources([]); setQuestion(''); }}
              className="text-xs text-teal-600 hover:text-teal-700"
            >
              Nuova domanda
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
