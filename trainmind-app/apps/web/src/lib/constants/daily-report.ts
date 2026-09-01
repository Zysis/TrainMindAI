/**
 * Menu del foglio di fine giornata.
 *
 * Qui stanno solo i codici, nell'ordine in cui devono comparire nei menu; le
 * etichette vivono nel namespace i18n `dailyVocab`. I codici sono gli stessi
 * di `@trainmind/types`, da cui si importano: un secondo elenco a mano
 * divergerebbe al primo ritocco.
 */
import {
  DailyNextTraining_CODES,
  DailyInjuryType_CODES,
  DailyBodyPart_CODES,
  DailySide_CODES,
  DailyClinicalStatus_CODES,
  DailyTaping_CODES,
  DailyTreatment_CODES,
  DailyTrainingType_CODES,
  DailyForecast_CODES,
} from '@trainmind/types';

/** I nove menu, nell'ordine di lettura del foglio cartaceo. */
export const CLINICAL_FIELDS = [
  { key: 'nextTraining', codes: DailyNextTraining_CODES },
  { key: 'injuryType', codes: DailyInjuryType_CODES },
  { key: 'bodyPart', codes: DailyBodyPart_CODES },
  { key: 'side', codes: DailySide_CODES },
  { key: 'clinicalStatus', codes: DailyClinicalStatus_CODES },
  { key: 'taping', codes: DailyTaping_CODES },
  { key: 'treatment', codes: DailyTreatment_CODES },
  { key: 'trainingType', codes: DailyTrainingType_CODES },
  { key: 'forecast', codes: DailyForecast_CODES },
] as const;

export type ClinicalFieldKey = (typeof CLINICAL_FIELDS)[number]['key'];

/** Colore della cella "prossimo allenamento", come sul foglio cartaceo. */
export const NEXT_TRAINING_TONE: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200',
  partial: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200',
  unavailable: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200',
};

/** Zone ACWR: sotto 0.8 poco carico, 0.8-1.3 ottimale, oltre 1.5 rischio. */
export const ACWR_TONE: Record<string, string> = {
  low: 'text-sky-600 dark:text-sky-400',
  optimal: 'text-emerald-600 dark:text-emerald-400',
  high: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
};
