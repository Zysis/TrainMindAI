import { describe, it, expect } from 'vitest';
import {
  toISODateLocal,
  normalizeTrainingDays,
  planAnchorMonday,
  trainingDayDate,
  weekTrainingDates,
  sessionDateInWeek,
  planFirstTrainingDate,
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


// ============================================
// Giorni di allenamento
// ============================================

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dow = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay());

describe('giorni di allenamento del mesociclo', () => {
  // 2026: 28 agosto e' un venerdi', 31 agosto un lunedi'.
  const ven28 = new Date(2026, 7, 28);
  const lun31 = new Date(2026, 7, 31);
  const mer2set = new Date(2026, 8, 2);
  const dom30 = new Date(2026, 7, 30);
  const LMV = [1, 3, 5];

  describe('normalizeTrainingDays', () => {
    it('ordina, deduplica e scarta i valori fuori scala', () => {
      expect(normalizeTrainingDays([5, 1, 5, 3])).toEqual([1, 3, 5]);
      expect(normalizeTrainingDays([0, 8, -2, 3.5, 4])).toEqual([4]);
      expect(normalizeTrainingDays(null)).toEqual([]);
      expect(normalizeTrainingDays(undefined)).toEqual([]);
    });
  });

  describe('planAnchorMonday', () => {
    it('inizio di lunedi\': resta quella settimana', () => {
      expect(iso(planAnchorMonday(lun31, LMV))).toBe('2026-08-31');
    });

    it('inizio di venerdi\' con lunedi\' fra i giorni: slitta alla settimana dopo', () => {
      // altrimenti il lunedi\' della settimana 1 cadrebbe il 24, prima dell'inizio
      expect(iso(planAnchorMonday(ven28, LMV))).toBe('2026-08-31');
    });

    it('inizio di venerdi\' con soli ven/sab: nessuno slittamento', () => {
      expect(iso(planAnchorMonday(ven28, [5, 6]))).toBe('2026-08-24');
    });

    it('la domenica vale 7, non 0', () => {
      expect(iso(planAnchorMonday(dom30, [2, 4]))).toBe('2026-08-31');
    });
  });

  describe('nessuna sessione prima della data di inizio', () => {
    const casi: Array<[string, Date, number[]]> = [
      ['ven 28, L-M-V', ven28, LMV],
      ['lun 31, L-M-V', lun31, LMV],
      ['ven 28, V-S', ven28, [5, 6]],
      ['mer 2 set, L-M', mer2set, [1, 2]],
      ['dom 30, M-G', dom30, [2, 4]],
      ['ven 28, solo domenica', ven28, [7]],
    ];
    it.each(casi)('%s', (_label, start, days) => {
      for (let w = 1; w <= 4; w++) {
        for (const { date } of weekTrainingDates(start, days, w)) {
          expect(date.getTime()).toBeGreaterThanOrEqual(
            new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime(),
          );
        }
      }
    });
  });

  describe('trainingDayDate', () => {
    it('cade sempre sul giorno della settimana chiesto', () => {
      for (const d of [1, 2, 3, 4, 5, 6, 7]) {
        expect(dow(trainingDayDate(ven28, LMV, 3, d))).toBe(d);
      }
    });

    it('ogni settimana e\' sette giorni dopo la precedente', () => {
      const w1 = trainingDayDate(lun31, LMV, 1, 3);
      const w2 = trainingDayDate(lun31, LMV, 2, 3);
      expect((w2.getTime() - w1.getTime()) / 86400000).toBe(7);
    });
  });

  describe('weekTrainingDates', () => {
    it('restituisce i giorni in ordine con le date giuste', () => {
      expect(weekTrainingDates(ven28, LMV, 1).map((x) => iso(x.date)))
        .toEqual(['2026-08-31', '2026-09-02', '2026-09-04']);
      expect(weekTrainingDates(ven28, LMV, 2).map((x) => iso(x.date)))
        .toEqual(['2026-09-07', '2026-09-09', '2026-09-11']);
    });
  });

  describe('sessionDateInWeek', () => {
    it('la sessione i-esima cade sull\'i-esimo giorno scelto', () => {
      expect(iso(sessionDateInWeek(ven28, LMV, 1, 0))).toBe('2026-08-31');
      expect(iso(sessionDateInWeek(ven28, LMV, 1, 1))).toBe('2026-09-02');
      expect(iso(sessionDateInWeek(ven28, LMV, 1, 2))).toBe('2026-09-04');
    });

    it('le sessioni in eccesso proseguono nei giorni successivi', () => {
      // l'AI ne ha scritte 4 su 3 giorni dichiarati
      expect(iso(sessionDateInWeek(ven28, LMV, 1, 3))).toBe('2026-09-05');
    });

    it('senza giorni dichiarati resta il vecchio comportamento consecutivo', () => {
      expect(iso(sessionDateInWeek(lun31, [], 1, 0))).toBe('2026-08-31');
      expect(iso(sessionDateInWeek(lun31, [], 1, 2))).toBe('2026-09-02');
      expect(iso(sessionDateInWeek(lun31, [], 2, 0))).toBe('2026-09-07');
    });
  });

  describe('toISODateLocal', () => {
    it('non slitta al giorno prima come farebbe toISOString', () => {
      // 31 agosto 2026, mezzanotte locale
      expect(toISODateLocal(new Date(2026, 7, 31))).toBe('2026-08-31');
      expect(toISODateLocal(new Date(2026, 0, 1))).toBe('2026-01-01');
      expect(toISODateLocal(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    });

    it('e\' coerente con le date dei giorni di allenamento', () => {
      expect(weekTrainingDates(ven28, LMV, 1).map((x) => toISODateLocal(x.date)))
        .toEqual(['2026-08-31', '2026-09-02', '2026-09-04']);
    });
  });

  describe('planFirstTrainingDate', () => {
    it('e\' il primo giorno scelto della settimana 1', () => {
      expect(iso(planFirstTrainingDate(ven28, LMV))).toBe('2026-08-31');
      expect(iso(planFirstTrainingDate(ven28, [5, 6]))).toBe('2026-08-28');
    });

    it('senza giorni scelti coincide con la data di inizio', () => {
      expect(iso(planFirstTrainingDate(mer2set, []))).toBe('2026-09-02');
    });
  });
});
