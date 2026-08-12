// ============================================
// TrainMind — Shared Utilities
// ============================================

/**
 * Format a date to locale string (Italian default)
 */
export function formatDate(date: Date | string, locale = 'it-IT'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a date to ISO date string (YYYY-MM-DD)
 */
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date | string): number {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Calculate sRPE (session Rating of Perceived Exertion)
 * sRPE = RPE * duration (minutes)
 */
export function calculateSRPE(rpe: number, durationMinutes: number): number {
  return rpe * durationMinutes;
}

/**
 * Calculate ACWR (Acute:Chronic Workload Ratio)
 * Acute = last 7 days avg, Chronic = last 28 days avg
 */
export function calculateACWR(dailyLoads: number[]): number {
  if (dailyLoads.length < 28) return 0;
  const acute = dailyLoads.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const chronic = dailyLoads.slice(-28).reduce((a, b) => a + b, 0) / 28;
  if (chronic === 0) return 0;
  return Math.round((acute / chronic) * 100) / 100;
}

/**
 * Calculate Wellness Score (0-100) from wellness log entries
 */
export function calculateWellnessScore(params: {
  sleepQuality: number; // 1-5
  fatigue: number; // 1-5 (inverted: 5 = high fatigue = bad)
  soreness: number; // 1-5 (inverted)
  stress: number; // 1-5 (inverted)
  mood: number; // 1-5
}): number {
  const { sleepQuality, fatigue, soreness, stress, mood } = params;
  const score =
    ((sleepQuality + (6 - fatigue) + (6 - soreness) + (6 - stress) + mood) / 25) * 100;
  return Math.round(score);
}

/**
 * Slug generator
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a random color from a consistent palette
 */
export function getAvatarColor(name: string): string {
  const colors = [
    '#0D9488', '#0F766E', '#14B8A6', '#2DD4BF',
    '#475569', '#64748B', '#94A3B8', '#334155',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get initials from name
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Sleep/delay utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
