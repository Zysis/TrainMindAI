// ============================================
// TrainMind AI — Frontend Constants
// ============================================

export const APP_NAME = 'TrainMind AI';
export const APP_DESCRIPTION = 'Piattaforma AI per preparatori fisici nel basket';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const API_PREFIX = '/api/v1';

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const POSITIONS = [
  'Point Guard',
  'Shooting Guard',
  'Small Forward',
  'Power Forward',
  'Center',
] as const;

export const RPE_SCALE = [
  { value: 1, label: '1 - Riposo', color: '#22C55E' },
  { value: 2, label: '2 - Molto leggero', color: '#22C55E' },
  { value: 3, label: '3 - Leggero', color: '#84CC16' },
  { value: 4, label: '4 - Moderato', color: '#84CC16' },
  { value: 5, label: '5 - Medio', color: '#F59E0B' },
  { value: 6, label: '6 - Medio-alto', color: '#F59E0B' },
  { value: 7, label: '7 - Alto', color: '#F97316' },
  { value: 8, label: '8 - Molto alto', color: '#EF4444' },
  { value: 9, label: '9 - Massimale', color: '#EF4444' },
  { value: 10, label: '10 - Estremo', color: '#DC2626' },
] as const;

export const EXERCISE_CATEGORIES = [
  'Forza',
  'Potenza',
  'Resistenza',
  'Velocita',
  'Agilita',
  'Flessibilita',
  'Propriocezione',
  'Core',
  'Pliometria',
  'Prevenzione',
  'Riabilitazione',
  'Condizionamento',
  'Basket-Specifico',
] as const;

export const WELLNESS_FIELDS = [
  { key: 'sleepHours', label: 'Ore Sonno', min: 0, max: 14, unit: 'h' },
  { key: 'sleepQuality', label: 'Qualita Sonno', min: 1, max: 5 },
  { key: 'fatigue', label: 'Fatica', min: 1, max: 5 },
  { key: 'soreness', label: 'Dolore Muscolare', min: 1, max: 5 },
  { key: 'stress', label: 'Stress', min: 1, max: 5 },
  { key: 'mood', label: 'Umore', min: 1, max: 5 },
] as const;
