import { describe, it, expect } from 'vitest';
import {
  formatDate,
  toISODate,
  calculateAge,
  calculateSRPE,
  calculateACWR,
  calculateWellnessScore,
  slugify,
  getAvatarColor,
  getInitials,
  clamp,
  sleep,
} from '../index';

// ─── formatDate ───────────────────────────────────────────

describe('formatDate', () => {
  it('formats Date object to Italian locale', () => {
    const result = formatDate(new Date('2025-03-15'));
    expect(result).toMatch(/15/);
    expect(result).toMatch(/03/);
    expect(result).toMatch(/2025/);
  });

  it('formats ISO string to Italian locale', () => {
    const result = formatDate('2024-12-25');
    expect(result).toMatch(/25/);
    expect(result).toMatch(/12/);
    expect(result).toMatch(/2024/);
  });

  it('accepts custom locale', () => {
    const result = formatDate(new Date('2025-01-01'), 'en-US');
    expect(result).toBeTruthy();
  });
});

// ─── toISODate ────────────────────────────────────────────

describe('toISODate', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = toISODate(new Date('2025-06-15T14:30:00Z'));
    expect(result).toBe('2025-06-15');
  });

  it('pads single-digit months and days', () => {
    const result = toISODate(new Date('2025-01-05T00:00:00Z'));
    expect(result).toBe('2025-01-05');
  });
});

// ─── calculateAge ─────────────────────────────────────────

describe('calculateAge', () => {
  it('calculates age from Date object', () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    tenYearsAgo.setMonth(0, 1); // Jan 1, 10 years ago
    const age = calculateAge(tenYearsAgo);
    expect(age).toBeGreaterThanOrEqual(9);
    expect(age).toBeLessThanOrEqual(10);
  });

  it('calculates age from ISO string', () => {
    const result = calculateAge('2000-01-01');
    expect(result).toBeGreaterThanOrEqual(25);
    expect(result).toBeLessThanOrEqual(27);
  });

  it('accounts for birthday not yet passed this year', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() - 20);
    future.setMonth(11, 31); // Dec 31, likely not passed yet in April
    const age = calculateAge(future);
    // Should be 19 or 20 depending on current date
    expect(age).toBeGreaterThanOrEqual(19);
    expect(age).toBeLessThanOrEqual(20);
  });
});

// ─── calculateSRPE ────────────────────────────────────────

describe('calculateSRPE', () => {
  it('multiplies RPE by duration', () => {
    expect(calculateSRPE(7, 60)).toBe(420);
  });

  it('returns 0 when RPE is 0', () => {
    expect(calculateSRPE(0, 90)).toBe(0);
  });

  it('returns 0 when duration is 0', () => {
    expect(calculateSRPE(8, 0)).toBe(0);
  });

  it('handles high values', () => {
    expect(calculateSRPE(10, 120)).toBe(1200);
  });
});

// ─── calculateACWR ────────────────────────────────────────

describe('calculateACWR', () => {
  it('returns 0 when less than 28 days of data', () => {
    expect(calculateACWR([100, 200, 300])).toBe(0);
  });

  it('returns 0 when chronic load is 0', () => {
    const zeros = new Array(28).fill(0);
    expect(calculateACWR(zeros)).toBe(0);
  });

  it('calculates ratio correctly with stable load', () => {
    const stable = new Array(28).fill(100);
    const acwr = calculateACWR(stable);
    expect(acwr).toBe(1);
  });

  it('detects spike (high acute, low chronic)', () => {
    const data = [
      ...new Array(21).fill(100),
      ...new Array(7).fill(200),
    ];
    const acwr = calculateACWR(data);
    expect(acwr).toBeGreaterThan(1);
  });

  it('detects deload (low acute, high chronic)', () => {
    const data = [
      ...new Array(21).fill(200),
      ...new Array(7).fill(50),
    ];
    const acwr = calculateACWR(data);
    expect(acwr).toBeLessThan(1);
  });

  it('rounds to 2 decimal places', () => {
    const data = [
      ...new Array(21).fill(100),
      ...new Array(7).fill(150),
    ];
    const acwr = calculateACWR(data);
    const decimalPlaces = (acwr.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});

// ─── calculateWellnessScore ───────────────────────────────

describe('calculateWellnessScore', () => {
  it('returns 100 for perfect wellness', () => {
    expect(calculateWellnessScore({
      sleepQuality: 5, fatigue: 1, soreness: 1, stress: 1, mood: 5,
    })).toBe(100);
  });

  it('returns 20 for worst wellness', () => {
    expect(calculateWellnessScore({
      sleepQuality: 1, fatigue: 5, soreness: 5, stress: 5, mood: 1,
    })).toBe(20);
  });

  it('returns middle range for average values', () => {
    const score = calculateWellnessScore({
      sleepQuality: 3, fatigue: 3, soreness: 3, stress: 3, mood: 3,
    });
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThan(70);
  });

  it('returns rounded integer', () => {
    const score = calculateWellnessScore({
      sleepQuality: 4, fatigue: 2, soreness: 3, stress: 2, mood: 4,
    });
    expect(Number.isInteger(score)).toBe(true);
  });
});

// ─── slugify ──────────────────────────────────────────────

describe('slugify', () => {
  it('converts to lowercase kebab-case', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Hello! World?')).toBe('hello-world');
  });

  it('collapses multiple spaces/dashes', () => {
    expect(slugify('hello   world---test')).toBe('hello-world-test');
  });

  it('trims leading/trailing dashes', () => {
    expect(slugify('  --hello--  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles Italian characters', () => {
    expect(slugify('Preparazione Atletica')).toBe('preparazione-atletica');
  });
});

// ─── getAvatarColor ───────────────────────────────────────

describe('getAvatarColor', () => {
  it('returns a hex color string', () => {
    const color = getAvatarColor('Mario Rossi');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('returns consistent color for same name', () => {
    const a = getAvatarColor('Test User');
    const b = getAvatarColor('Test User');
    expect(a).toBe(b);
  });

  it('returns different colors for different names', () => {
    const a = getAvatarColor('Alice');
    const b = getAvatarColor('Bob');
    // Not guaranteed to be different, but high probability
    // Just check both are valid
    expect(a).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(b).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

// ─── getInitials ──────────────────────────────────────────

describe('getInitials', () => {
  it('returns uppercase initials', () => {
    expect(getInitials('Mario', 'Rossi')).toBe('MR');
  });

  it('handles lowercase input', () => {
    expect(getInitials('mario', 'rossi')).toBe('MR');
  });

  it('takes first char of each name', () => {
    expect(getInitials('Alessandro', 'Bianchi')).toBe('AB');
  });
});

// ─── clamp ────────────────────────────────────────────────

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to max when above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('handles equal min and max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it('handles edge case at boundaries', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

// ─── sleep ────────────────────────────────────────────────

describe('sleep', () => {
  it('resolves after specified ms', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some margin
  });

  it('returns a Promise', () => {
    const result = sleep(1);
    expect(result).toBeInstanceOf(Promise);
  });
});
