'use client';

import { Pencil, Trash2, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Exercise } from '@/types';

interface ExerciseCardProps {
  exercise: Exercise;
  onEdit: (ex: Exercise) => void;
  onDelete: (ex: Exercise) => void;
  onPlayVideo: (name: string, url: string) => void;
}

export function ExerciseCard({ exercise, onEdit, onDelete, onPlayVideo }: ExerciseCardProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('exercises');

  return (
    <div className="card-hover group relative">
      {/* Action buttons */}
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(exercise); }}
          className="rounded-md bg-white dark:bg-slate-800 p-1.5 text-slate-400 dark:text-slate-500 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition-colors hover:text-teal-600"
          title={tCommon('edit')}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(exercise); }}
          className="rounded-md bg-white dark:bg-slate-800 p-1.5 text-slate-400 dark:text-slate-500 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition-colors hover:text-red-600"
          title={tCommon('delete')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card content -- click to edit */}
      <div onClick={() => onEdit(exercise)} className="cursor-pointer">
        <h3 className="pr-16 font-semibold text-slate-900 dark:text-white">{exercise.name}</h3>
        {exercise.description && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{exercise.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {exercise.muscleGroups.slice(0, 3).map((mg) => (
            <span key={mg} className="rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-2xs text-slate-600 dark:text-slate-400">
              {mg}
            </span>
          ))}
          {exercise.muscleGroups.length > 3 && (
            <span className="text-2xs text-slate-400 dark:text-slate-500">+{exercise.muscleGroups.length - 3}</span>
          )}
        </div>
        {exercise.equipment.length > 0 && (
          <p className="mt-2 text-2xs text-slate-400 dark:text-slate-500">
            {t('equipmentLabel')} {exercise.equipment.join(', ')}
          </p>
        )}
        {exercise.videoUrl && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlayVideo(exercise.name, exercise.videoUrl!); }}
            className="mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs text-teal-600 hover:bg-teal-50 hover:text-teal-700 transition"
          >
            <Video className="h-3 w-3" />
            {t('watchVideo')}
          </button>
        )}
      </div>
    </div>
  );
}
