/**
 * Etichette e colori degli infortuni e dei protocolli RTP.
 *
 * Stanno qui e non dentro una pagina perche' servono in piu' punti — la scheda
 * Infortuni e il tab dell'atleta — e due copie di queste tabelle finirebbero
 * per divergere, com'e' gia' successo in questo progetto con metriche,
 * categorie esercizi e posizioni.
 *
 * Sono chiavi i18n, non testo: la traduzione avviene nel componente.
 */

import type { InjuryLocation } from '@trainmind/types';

export const PHASE_LABEL_KEYS: Record<string, string> = {
  PHASE_1: 'phase1Label',
  PHASE_2: 'phase2Label',
  PHASE_3: 'phase3Label',
  PHASE_4: 'phase4Label',
  PHASE_5: 'phase5Label',
  CLEARED: 'clearedLabel',
};

export const PHASE_SHORT_KEYS: Record<string, string> = {
  PHASE_1: 'phase1Short',
  PHASE_2: 'phase2Short',
  PHASE_3: 'phase3Short',
  PHASE_4: 'phase4Short',
  PHASE_5: 'phase5Short',
  CLEARED: 'clearedShort',
};

export const PHASE_COLORS: Record<string, string> = {
  PHASE_1: 'bg-red-100 text-red-700 border-red-200',
  PHASE_2: 'bg-orange-100 text-orange-700 border-orange-200',
  PHASE_3: 'bg-amber-100 text-amber-700 border-amber-200',
  PHASE_4: 'bg-blue-100 text-blue-700 border-blue-200',
  PHASE_5: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  PHASE_6: 'bg-violet-100 text-violet-700 border-violet-200',
  CLEARED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

/**
 * Sequenza storica: vale solo per i protocolli avviati prima della libreria,
 * che non hanno fasi proprie. Per tutti gli altri le fasi (da 3 a 6) sono
 * quelle del protocollo, con i loro nomi.
 */
export const PHASE_ORDER = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5', 'CLEARED'];

export const SEVERITY_LABEL_KEYS = ['', 'severityMild', 'severityMinor', 'severityModerate', 'severitySevere', 'severityVerySevere'];
export const SEVERITY_COLORS = ['', 'text-green-600', 'text-yellow-600', 'text-orange-600', 'text-red-600', 'text-red-800'];

export const INJURY_TYPE_DEFS: { value: string; labelKey: string }[] = [
  { value: 'muscular', labelKey: 'typeMuscular' },
  { value: 'tendon', labelKey: 'typeTendon' },
  { value: 'ligament', labelKey: 'typeLigament' },
  { value: 'bone', labelKey: 'typeBone' },
  { value: 'joint', labelKey: 'typeJoint' },
];

/** Tipi non più selezionabili: restano per leggere gli infortuni storici */
export const LEGACY_TYPE_DEFS: { value: string; labelKey: string }[] = [
  { value: 'contusion', labelKey: 'typeContusion' },
  { value: 'overuse', labelKey: 'typeOveruse' },
  { value: 'other', labelKey: 'typeOther' },
];

export const INJURY_ONSET_DEFS: { value: string; labelKey: string }[] = [
  { value: 'contusive', labelKey: 'onsetContusive' },
  { value: 'overuse', labelKey: 'onsetOveruse' },
  { value: 'traumatic', labelKey: 'onsetTraumatic' },
  { value: 'non_traumatic', labelKey: 'onsetNonTraumatic' },
];

/**
 * Le voci del menu "sede". Il tipo del campo `value` e' `InjuryLocation`, non
 * `string`: se questa lista e l'elenco canonico in @trainmind/types divergono,
 * il type-check se ne accorge invece di lasciare che una voce inesistente
 * arrivi all'API e venga rifiutata a runtime.
 */
export const BODY_LOCATION_DEFS: { value: InjuryLocation; labelKey: string }[] = [
  { value: 'ankle_l', labelKey: 'locAnkleL' },
  { value: 'ankle_r', labelKey: 'locAnkleR' },
  { value: 'knee_l', labelKey: 'locKneeL' },
  { value: 'knee_r', labelKey: 'locKneeR' },
  { value: 'hamstring_l', labelKey: 'locHamstringL' },
  { value: 'hamstring_r', labelKey: 'locHamstringR' },
  { value: 'quadriceps_l', labelKey: 'locQuadL' },
  { value: 'quadriceps_r', labelKey: 'locQuadR' },
  { value: 'calf_l', labelKey: 'locCalfL' },
  { value: 'calf_r', labelKey: 'locCalfR' },
  { value: 'groin', labelKey: 'locGroin' },
  { value: 'hip_l', labelKey: 'locHipL' },
  { value: 'hip_r', labelKey: 'locHipR' },
  { value: 'back_lower', labelKey: 'locBackLower' },
  { value: 'back_upper', labelKey: 'locBackUpper' },
  { value: 'shoulder_l', labelKey: 'locShoulderL' },
  { value: 'shoulder_r', labelKey: 'locShoulderR' },
  { value: 'arm_l', labelKey: 'locArmL' },
  { value: 'arm_r', labelKey: 'locArmR' },
  { value: 'wrist_l', labelKey: 'locWristL' },
  { value: 'wrist_r', labelKey: 'locWristR' },
  { value: 'finger', labelKey: 'locFinger' },
  { value: 'foot_l', labelKey: 'locFootL' },
  { value: 'foot_r', labelKey: 'locFootR' },
  { value: 'other', labelKey: 'locOther' },
];

/** Etichetta di un tipo, compresi quelli storici non piu' selezionabili. */
export function injuryTypeLabelKey(value: string): string | null {
  const def = [...INJURY_TYPE_DEFS, ...LEGACY_TYPE_DEFS].find((d) => d.value === value);
  return def ? def.labelKey : null;
}

/** Etichetta di una sede: le sedi non standard sono testo libero legittimo. */
export function bodyLocationLabelKey(value: string): string | null {
  const def = BODY_LOCATION_DEFS.find((d) => d.value === value);
  return def ? def.labelKey : null;
}
