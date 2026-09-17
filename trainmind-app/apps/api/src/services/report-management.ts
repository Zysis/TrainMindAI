/**
 * Report per la DIRIGENZA.
 *
 * Chi lo legge non e' un preparatore: vuole sapere quanti giocatori ha a
 * disposizione, chi manca e per quanto, e se la squadra sta bene. Quindi:
 *   - niente ACWR, sRPE, fasi RTP: il carico diventa un semaforo;
 *   - niente dati clinici: di un atleta fermo si dicono nome, stato e rientro
 *     previsto — mai tipo, sede o gravita' dell'infortunio;
 *   - il testo e' discorsivo (AI, oppure costruito dai numeri se l'AI non
 *     risponde: la sezione non resta mai vuota).
 *
 * Il carico usa `acwrLoadPoints` + `computeAcwr` di @trainmind/utils, la
 * stessa regola della dashboard: il semaforo non puo' dire una cosa diversa
 * dal pannello "Atleti a rischio".
 */

import type { FastifyInstance } from 'fastify';
import type {
  ManagementReportData,
  ReportChart,
  ReportKPI,
  ReportMetadata,
  ReportTable,
} from '@trainmind/types';
import { calculateWellnessScore, computeAcwr } from '@trainmind/utils';
import { acwrLoadPoints } from '../lib/acwr-loads.js';

const DAY_MS = 86_400_000;

type AthleteRow = { id: string; firstName: string; lastName: string };

type InjuryRow = {
  athleteId: string;
  status: 'ACTIVE' | 'RECOVERING' | 'RESOLVED';
  dateOccurred: Date;
  dateResolved: Date | null;
  rtpProtocols: Array<{ currentPhase: string; targetDate: Date | null }>;
};

type Availability = 'available' | 'limited' | 'unavailable';

/** Lunedi' (UTC) della settimana che contiene `d`, come YYYY-MM-DD */
function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

function longDate(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Un infortunio conta come "aperto" a una data se era gia' successo e non
 * era ancora chiuso. Un RESOLVED senza data di chiusura (dato vecchio) si
 * considera chiuso; un protocollo RTP arrivato a CLEARED anche.
 */
function openAt(inj: InjuryRow, t: Date): boolean {
  if (inj.dateOccurred > t) return false;
  if (inj.dateResolved) return inj.dateResolved > t;
  if (inj.status === 'RESOLVED') return false;
  return inj.rtpProtocols[0]?.currentPhase !== 'CLEARED';
}

function availabilityAt(injuries: InjuryRow[], t: Date): Availability {
  const open = injuries.filter((i) => openAt(i, t));
  if (open.length === 0) return 'available';
  // Da quando un atleta e' in RECOVERING il suo stato e' "rientro graduale":
  // puo' allenarsi in parte. ACTIVE = fermo.
  return open.some((i) => i.status === 'ACTIVE') ? 'unavailable' : 'limited';
}

export function wellnessLabel(score: number | null): string {
  if (score === null) return 'dati non disponibili';
  if (score >= 70) return 'buono';
  if (score >= 55) return 'discreto';
  return 'basso';
}

async function scopeAthletes(
  app: FastifyInstance,
  organizationId: string,
  teamId?: string,
  athleteId?: string,
): Promise<AthleteRow[]> {
  const select = { id: true, firstName: true, lastName: true } as const;
  if (athleteId) {
    return app.prisma.athlete.findMany({ where: { id: athleteId, organizationId }, select });
  }
  if (teamId) {
    const rows = await app.prisma.athleteTeam.findMany({
      where: { teamId, team: { organizationId }, athlete: { isActive: true } },
      select: { athlete: { select } },
    });
    return rows.map((r) => r.athlete);
  }
  return app.prisma.athlete.findMany({ where: { organizationId, isActive: true }, select });
}

export async function aggregateManagement(
  app: FastifyInstance,
  organizationId: string,
  from: Date,
  to: Date,
  metadata: ReportMetadata,
  teamId?: string,
  athleteId?: string,
): Promise<ManagementReportData> {
  const prisma = app.prisma;
  const athletes = await scopeAthletes(app, organizationId, teamId, athleteId);
  const ids = athletes.map((a) => a.id);
  const total = athletes.length;

  // La fotografia si fa a fine periodo, ma mai nel futuro.
  const now = new Date();
  const asOf = to > now ? now : to;

  const injuries = (await prisma.injury.findMany({
    where: {
      athleteId: { in: ids },
      dateOccurred: { lte: asOf },
      OR: [{ dateResolved: null }, { dateResolved: { gte: from } }],
    },
    select: {
      athleteId: true,
      status: true,
      dateOccurred: true,
      dateResolved: true,
      rtpProtocols: {
        select: { currentPhase: true, targetDate: true },
        orderBy: { startDate: 'desc' },
        take: 1,
      },
    },
  })) as InjuryRow[];

  const injuriesByAthlete = new Map<string, InjuryRow[]>();
  for (const i of injuries) {
    const list = injuriesByAthlete.get(i.athleteId) ?? [];
    list.push(i);
    injuriesByAthlete.set(i.athleteId, list);
  }

  // ─── Disponibilita' oggi ─────────────────────────────────
  const status = new Map<string, Availability>();
  for (const a of athletes) {
    status.set(a.id, availabilityAt(injuriesByAthlete.get(a.id) ?? [], asOf));
  }
  const count = (s: Availability) => [...status.values()].filter((v) => v === s).length;
  const available = count('available');
  const limited = count('limited');
  const unavailable = count('unavailable');

  // Giornate-atleta perse: per ogni infortunio, i giorni dentro il periodo
  // in cui era aperto. Si contano gli interi giorni, almeno uno.
  let daysLost = 0;
  for (const i of injuries) {
    const start = i.dateOccurred > from ? i.dateOccurred : from;
    const endRaw = i.dateResolved ?? (i.status === 'RESOLVED' ? i.dateOccurred : asOf);
    const end = endRaw < asOf ? endRaw : asOf;
    if (end <= start) continue;
    daysLost += Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  }

  const unavailableRows: Array<Array<string | number>> = [];
  for (const a of athletes) {
    const s = status.get(a.id);
    if (s === 'available') continue;
    const open = (injuriesByAthlete.get(a.id) ?? []).filter((i) => openAt(i, asOf));
    const targets = open
      .map((i) => i.rtpProtocols[0]?.targetDate)
      .filter((d): d is Date => d instanceof Date);
    const target = targets.length ? new Date(Math.max(...targets.map((d) => d.getTime()))) : null;
    let ret = 'Da definire';
    if (target) {
      const days = Math.ceil((target.getTime() - asOf.getTime()) / DAY_MS);
      const when = days <= 1 ? 'a giorni' : days < 14 ? `tra ${days} giorni` : `tra circa ${Math.round(days / 7)} settimane`;
      ret = target < asOf ? 'In valutazione' : `${longDate(target)} (${when})`;
    }
    unavailableRows.push([
      `${a.lastName} ${a.firstName}`,
      s === 'unavailable' ? 'Non disponibile' : 'Rientro graduale in corso',
      ret,
    ]);
  }
  unavailableRows.sort((x, y) => String(x[1]).localeCompare(String(y[1])) || String(x[0]).localeCompare(String(y[0])));

  const unavailableAthletes: ReportTable = {
    title: 'Chi manca e quando rientra',
    columns: ['Atleta', 'Situazione', 'Rientro previsto'],
    rows: unavailableRows,
    footnote: 'Le date di rientro sono stime dello staff medico e possono cambiare.',
  };

  // ─── Disponibilita' settimana per settimana ──────────────
  const weekLabels: string[] = [];
  const weekValues: number[] = [];
  for (let w = mondayOf(from); w <= asOf; w = new Date(w.getTime() + 7 * DAY_MS)) {
    const weekEnd = new Date(w.getTime() + 7 * DAY_MS - 1);
    const t = weekEnd < asOf ? weekEnd : asOf;
    let ok = 0;
    for (const a of athletes) {
      if (availabilityAt(injuriesByAthlete.get(a.id) ?? [], t) === 'available') ok++;
    }
    weekLabels.push(shortDate(w < from ? from : w));
    weekValues.push(total > 0 ? Math.round((ok / total) * 100) : 0);
  }
  const availabilityTrend: ReportChart = {
    title: 'Rosa disponibile, settimana per settimana (%)',
    type: 'bar',
    labels: weekLabels,
    datasets: [{ label: 'Atleti disponibili (%)', data: weekValues, color: '#0d9488' }],
    yMax: 100,
  };

  // ─── Benessere ───────────────────────────────────────────
  const wellnessLogs = await prisma.wellnessLog.findMany({
    where: { athleteId: { in: ids }, date: { gte: from, lte: to } },
    select: { date: true, sleepQuality: true, mood: true, fatigue: true, soreness: true, stress: true },
  });
  const byWeek = new Map<number, number[]>();
  const last7: number[] = [];
  const last7From = new Date(asOf.getTime() - 7 * DAY_MS);
  for (const w of wellnessLogs) {
    const score = calculateWellnessScore(w);
    const k = mondayOf(w.date).getTime();
    const list = byWeek.get(k) ?? [];
    list.push(score);
    byWeek.set(k, list);
    if (w.date > last7From && w.date <= asOf) last7.push(score);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  const wellnessTrend: ReportChart = {
    title: 'Benessere medio della squadra (0-100)',
    type: 'line',
    labels: weeks.map((k) => shortDate(new Date(k) < from ? from : new Date(k))),
    datasets: [{ label: 'Benessere', data: weeks.map((k) => Math.round(avg(byWeek.get(k)!)!)), color: '#6366f1' }],
    yMax: 100,
  };
  const wellnessAverageRaw = avg(last7) ?? avg(wellnessLogs.map((w) => calculateWellnessScore(w)));
  const wellnessAverage = wellnessAverageRaw === null ? null : Math.round(wellnessAverageRaw);

  // ─── Carico: semaforo, solo per chi e' a disposizione ───
  const loadRisk = { green: 0, yellow: 0, red: 0, noData: 0 };
  const eligible = athletes.filter((a) => status.get(a.id) !== 'unavailable').map((a) => a.id);
  const points = await acwrLoadPoints(prisma, eligible, asOf);
  for (const id of eligible) {
    const r = computeAcwr(points.get(id) ?? [], asOf);
    if (!r.zone) loadRisk.noData++;
    else if (r.zone === 'optimal') loadRisk.green++;
    else if (r.zone === 'danger') loadRisk.red++;
    else loadRisk.yellow++;
  }

  // ─── KPI ─────────────────────────────────────────────────
  const ratio = total > 0 ? available / total : 0;
  const toWatch = loadRisk.yellow + loadRisk.red;
  const kpis: ReportKPI[] = [
    {
      label: 'Atleti disponibili',
      value: `${available} su ${total}`,
      severity: ratio >= 0.85 ? 'success' : ratio >= 0.7 ? 'warning' : 'danger',
    },
    {
      label: 'Fermi o in rientro',
      value: unavailable + limited,
      severity: unavailable === 0 ? (limited === 0 ? 'success' : 'info') : unavailable > 2 ? 'danger' : 'warning',
    },
    { label: 'Giornate perse per infortunio', value: daysLost, severity: 'info' },
    {
      label: 'Benessere squadra',
      value: wellnessAverage === null ? '—' : `${wellnessAverage}/100 (${wellnessLabel(wellnessAverage)})`,
      severity: wellnessAverage === null ? 'info' : wellnessAverage >= 70 ? 'success' : wellnessAverage >= 55 ? 'warning' : 'danger',
    },
    {
      label: "Carichi da tenere d'occhio",
      value: toWatch,
      severity: loadRisk.red > 0 ? 'danger' : loadRisk.yellow > 0 ? 'warning' : 'success',
    },
  ];

  return {
    audience: 'MANAGEMENT',
    metadata,
    summary: '',
    highlights: [],
    kpis,
    availability: {
      total,
      available,
      limited,
      unavailable,
      daysLost,
      asOf: asOf.toISOString().slice(0, 10),
    },
    availabilityTrend,
    unavailableAthletes,
    teamHealth: { wellnessTrend, wellnessAverage, loadRisk },
  };
}

/** "1 atleta" / "3 atleti" */
function n(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Testo discorsivo costruito solo dai numeri: e' quello che si legge quando
 * l'AI e' spenta, fuori quota o non risponde.
 */
export function buildManagementNarrative(r: ManagementReportData): { summary: string; highlights: string[] } {
  const { availability: a, teamHealth: h } = r;
  const from = new Date(r.metadata.periodFrom);
  const to = new Date(r.metadata.periodTo);
  const pct = a.total > 0 ? Math.round((a.available / a.total) * 100) : 0;
  const period = `Nel periodo dal ${longDate(from)} al ${longDate(to)}`;
  const parts: string[] = [];

  if (r.metadata.athleteName) {
    // Report del singolo atleta: niente percentuali di rosa
    const row = r.unavailableAthletes.rows[0];
    parts.push(
      !row
        ? `${period}, ${r.metadata.athleteName} risulta a disposizione.`
        : `${period}, ${r.metadata.athleteName} ${row[1] === 'Non disponibile' ? 'non è disponibile per infortunio' : 'sta rientrando gradualmente da un infortunio'}; rientro previsto: ${String(row[2]).toLowerCase()}.`,
    );
    if (a.daysLost > 0) parts.push(`Nel periodo ha saltato ${n(a.daysLost, 'giornata', 'giornate')} per infortunio.`);
    if (h.wellnessAverage !== null) {
      parts.push(`Il benessere che dichiara è ${wellnessLabel(h.wellnessAverage)} (${h.wellnessAverage} su 100).`);
    }
    if (h.loadRisk.red > 0) parts.push('Il carico di lavoro recente è in zona di rischio.');
    else if (h.loadRisk.yellow > 0) parts.push('Il carico di lavoro recente va seguito con attenzione.');
    else if (h.loadRisk.green > 0) parts.push('Il carico di lavoro è equilibrato.');
    const hl = [row ? `${row[1]} · rientro: ${row[2]}` : 'A disposizione'];
    if (h.wellnessAverage !== null) hl.push(`Benessere ${wellnessLabel(h.wellnessAverage)}`);
    return { summary: parts.join(' '), highlights: hl };
  }

  const scope = r.metadata.teamName ? `per ${r.metadata.teamName}` : 'per la società';
  parts.push(
    `${period}, ${scope}, risultano a disposizione ${a.available} atleti su ${a.total} (${pct}%).`,
  );
  if (a.unavailable + a.limited === 0) {
    parts.push('Al momento non ci sono giocatori fermi per infortunio.');
  } else {
    const bits: string[] = [];
    if (a.unavailable > 0) bits.push(n(a.unavailable, 'giocatore è fermo', 'giocatori sono fermi'));
    if (a.limited > 0) bits.push(`${n(a.limited, 'sta rientrando', 'stanno rientrando')} gradualmente`);
    parts.push(`${bits.join(' e ')} per infortunio.`);
  }
  if (a.daysLost > 0) {
    parts.push(`Nel periodo si sono perse complessivamente ${n(a.daysLost, 'giornata-atleta', 'giornate-atleta')} per infortunio.`);
  }
  if (h.wellnessAverage !== null) {
    parts.push(`Il benessere medio dichiarato dai giocatori è ${wellnessLabel(h.wellnessAverage)} (${h.wellnessAverage} su 100).`);
  }
  const assessed = h.loadRisk.green + h.loadRisk.yellow + h.loadRisk.red;
  if (assessed > 0) {
    if (h.loadRisk.yellow + h.loadRisk.red === 0) {
      parts.push('I carichi di lavoro sono equilibrati per tutti gli atleti valutati.');
    } else {
      const bits = [`${n(h.loadRisk.green, 'atleta è', 'atleti sono')} in equilibrio`];
      if (h.loadRisk.yellow > 0) bits.push(`${n(h.loadRisk.yellow, 'va seguito', 'vanno seguiti')} con attenzione`);
      if (h.loadRisk.red > 0) bits.push(`${n(h.loadRisk.red, 'è', 'sono')} in zona di rischio`);
      parts.push(`Sui carichi di lavoro, ${bits.slice(0, -1).join(', ')} e ${bits[bits.length - 1]}.`);
    }
  }

  const highlights: string[] = [`Disponibilità della rosa: ${pct}%`];
  if (r.unavailableAthletes.rows.length > 0) {
    const names = r.unavailableAthletes.rows.slice(0, 3).map((row) => String(row[0])).join(', ');
    highlights.push(`Assenti o in rientro: ${names}${r.unavailableAthletes.rows.length > 3 ? ' e altri' : ''}`);
  }
  if (h.wellnessAverage !== null) highlights.push(`Benessere squadra ${wellnessLabel(h.wellnessAverage)}`);
  if (h.loadRisk.red > 0) highlights.push(`${n(h.loadRisk.red, 'atleta', 'atleti')} con carico in zona di rischio`);
  else if (h.loadRisk.yellow > 0) highlights.push(`${n(h.loadRisk.yellow, 'atleta', 'atleti')} con carico da monitorare`);

  return { summary: parts.join(' '), highlights: highlights.slice(0, 4) };
}
