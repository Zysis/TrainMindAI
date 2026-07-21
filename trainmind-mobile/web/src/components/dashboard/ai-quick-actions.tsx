'use client';

import Link from 'next/link';
import { Sparkles, MessageSquare, FileText, Heart } from 'lucide-react';

interface AiQuickActionsProps {
  t: (key: string) => string;
}

export function AiQuickActions({ t }: AiQuickActionsProps) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-teal-600" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('aiAssistant')}</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/dashboard/chat" className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-4 transition-colors hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-slate-700">
            <MessageSquare className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('chatWithAI')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('askAICoach')}</p>
          </div>
        </Link>
        <Link href="/dashboard/training" className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-4 transition-colors hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-slate-700">
            <FileText className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('generateAIPlan')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('createTrainingPlans')}</p>
          </div>
        </Link>
        <Link href="/dashboard/wellness" className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-4 transition-colors hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100 dark:bg-slate-700">
            <Heart className="h-5 w-5 text-pink-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('wellnessAnalysis')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('aiWellnessInsights')}</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
