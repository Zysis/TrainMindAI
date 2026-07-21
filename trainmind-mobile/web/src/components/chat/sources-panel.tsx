'use client';

import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { SourceUI } from '@/hooks/use-chat';

interface SourcesPanelProps {
  sources: SourceUI[];
}

function scoreColor(score: number): string {
  if (score >= 0.55) return 'bg-green-100 text-green-700';
  if (score >= 0.35) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    exercises: 'Esercizi',
    protocols: 'Protocolli',
    periodization: 'Periodizzazione',
    references: 'Riferimenti',
  };
  return labels[category] || category;
}

export function SourcesPanel({ sources }: SourcesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="ml-11 mt-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 transition-colors"
      >
        <BookOpen className="h-3 w-3" />
        <span>{sources.length} {sources.length === 1 ? 'fonte' : 'fonti'} utilizzate</span>
        {isOpen ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1.5">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
            >
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ${scoreColor(source.score)}`}
              >
                {Math.round(source.score * 100)}%
              </span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate flex-1">
                {source.title}
              </span>
              <span className="text-2xs text-slate-400 dark:text-slate-500">
                {categoryLabel(source.category)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
