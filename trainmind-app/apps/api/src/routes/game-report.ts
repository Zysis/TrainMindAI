/**
 * Report post-partita.
 *
 * Endpoints (tutti sotto /api/v1):
 *   GET /game-report/list?teamId=&from=&to=   partite COMPLETATE, per il menu
 *   GET /game-report/:id?locale=              il report di una partita
 *   PUT /game-report/:id/readiness            aspettative 0-5 e note
 *   GET /game-report/:id/export?format=       PDF o DOCX
 *
 * Solo partite completate: prima del fischio finale i minuti sono un
 * cronometro in corsa e il report sarebbe una fotografia di qualcosa che
 * ancora si muove. La lista filtra su `status = 'COMPLETED'` e il dettaglio
 * rifiuta le altre con 409.
 *
 * Tutto e' ricalcolato a ogni apertura tranne le aspettative e le note, che
 * sono le uniche cose scritte a mano.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireMinRole } from '../middleware/rbac.js';
import { computeAcwr } from '@trainmind/utils';
import { acwrLoadPoints } from '../lib/acwr-loads.js';
import type {
  GameReportData,
  GameReportPlayer,
  GameReportStint,
  GameReportListItem,
} from '@trainmind/types';
import { renderGameReportPdf } from '../services/game-report-pdf.js';
import { renderGameReportDocx } from '../services/game-report-docx.js';

type Locale = 'it' | 'en' | 'es';

/** Come il foglio partita salva un turno in campo (colonna `stints`, Json). */
interface StoredStint {
  quarter?: number;
  inMs?: number;
  outMs?: number | null;
  durationMs?: number;
  breaks?: number;
}

// ─── Etichette ──────────────────────────────────────────
// I renderer girano lato server e non hanno next-intl: arrivano gia' tradotte.

const STATUS_LABELS: Record<Locale, Record<number, string>> = {
  it: { 0: 'Stop', 1: 'Riabilitazione', 2: 'Condizionamento / Tecnica', 3: 'Carico ridotto', 4: 'Con sostituzioni', 5: 'Allenamento completo' },
  en: { 0: 'Stop', 1: 'Rehab', 2: 'Conditioning / Skills', 3: 'Reduced load', 4: 'With substitutions', 5: 'Full training' },
  es: { 0: 'Stop', 1: 'Rehabilitación', 2: 'Acondicionamiento / Técnica', 3: 'Carga reducida', 4: 'Con sustituciones', 5: 'Entrenamiento completo' },
};

const LABELS: Record<Locale, Record<string, string>> = {
  it: {
    reportTitle: 'REPORT POST-PARTITA',
    readinessTitle: 'Disponibilità',
    player: 'Giocatore',
    minutes: 'Min',
    trainingExpectation: 'Aspettative allenamento',
    notes: 'Note',
    stintsTitle: 'Turni in campo',
    stintsPerPeriod: 'Minuti per periodo',
    stint: 'Turno',
    stintDetail: 'Dettaglio turni',
    stintCount: 'N. turni',
    period: 'Periodo',
    onCourt: 'In campo',
    breaks: 'Interruzioni',
    total: 'TOTALE',
    loadTitle: 'Carico della partita',
    rpe: 'RPE',
    load: 'Carico',
    acwr: 'ACWR',
    seasonAvg: 'Media stagione',
    delta: 'Scarto',
    summaryTitle: 'Riepilogo squadra',
    playersUsed: 'Giocatori impiegati',
    playersDressed: 'A referto',
    totalMinutes: 'Minuti distribuiti',
    expectedMinutes: 'Minuti disponibili',
    avgRpe: 'RPE medio',
    totalLoad: 'Carico totale',
    avgStints: 'Turni medi per giocatore',
    totalBreaks: 'Interruzioni totali',
    dnp: 'DNP',
    noPlayers: 'Nessun giocatore a referto.',
    notCompleted: 'Partita non completata.',
    generatedBy: 'Compilato da',
    zoneLow: 'Sottocarico', zoneOptimal: 'Ottimale', zoneHigh: 'Alto', zoneDanger: 'Rischio',
  },
  en: {
    reportTitle: 'POST-GAME REPORT',
    readinessTitle: 'Readiness',
    player: 'Player',
    minutes: 'Min',
    trainingExpectation: 'Training expectations',
    notes: 'Notes',
    stintsTitle: 'Stints',
    stintsPerPeriod: 'Minutes per period',
    stint: 'Stint',
    stintDetail: 'Stint detail',
    stintCount: 'Stints',
    period: 'Period',
    onCourt: 'On court',
    breaks: 'Stoppages',
    total: 'TOTAL',
    loadTitle: 'Game load',
    rpe: 'RPE',
    load: 'Load',
    acwr: 'ACWR',
    seasonAvg: 'Season avg',
    delta: 'Delta',
    summaryTitle: 'Team summary',
    playersUsed: 'Players used',
    playersDressed: 'Dressed',
    totalMinutes: 'Minutes distributed',
    expectedMinutes: 'Minutes available',
    avgRpe: 'Average RPE',
    totalLoad: 'Total load',
    avgStints: 'Average stints per player',
    totalBreaks: 'Total stoppages',
    dnp: 'DNP',
    noPlayers: 'No players dressed.',
    notCompleted: 'Game not completed.',
    generatedBy: 'Filled in by',
    zoneLow: 'Undertrained', zoneOptimal: 'Optimal', zoneHigh: 'High', zoneDanger: 'Risk',
  },
  es: {
    reportTitle: 'INFORME POST-PARTIDO',
    readinessTitle: 'Disponibilidad',
    player: 'Jugador',
    minutes: 'Min',
    trainingExpectation: 'Expectativas de entrenamiento',
    notes: 'Notas',
    stintsTitle: 'Turnos en pista',
    stintsPerPeriod: 'Minutos por periodo',
    stint: 'Turno',
    stintDetail: 'Detalle de turnos',
    stintCount: 'N.º turnos',
    period: 'Periodo',
    onCourt: 'En pista',
    breaks: 'Interrupciones',
    total: 'TOTAL',
    loadTitle: 'Carga del partido',
    rpe: 'RPE',
    load: 'Carga',
    acwr: 'ACWR',
    seasonAvg: 'Media temporada',
    delta: 'Diferencia',
    summaryTitle: 'Resumen del equipo',
    playersUsed: 'Jugadores utilizados',
    playersDressed: 'Convocados',
    totalMinutes: 'Minutos distribuidos',
    expectedMinutes: 'Minutos disponibles',
    avgRpe: 'RPE medio',
    totalLoad: 'Carga total',
    avgStints: 'Turnos medios por jugador',
    totalBreaks: 'Interrupciones totales',
    dnp: 'DNP',
    noPlayers: 'Ningún jugador convocado.',
    notCompleted: 'Partido no completado.',
    generatedBy: 'Rellenado por',
    zoneLow: 'Baja carga', zoneOptimal: 'Óptima', zoneHigh: 'Alta', zoneDanger: 'Riesgo',
  },
};

// ─── Helpers ────────────────────────────────────────────

function normalizeLocale(raw: unknown): Locale {
  return raw === 'en' || raw === 'es' ? raw : 'it';
}

function periodLabel(index: number, quarters: number): string {
  return index <= quarters ? `Q${index}` : `OT${index - quarters}`;
}

function minutesFromMs(ms: number): number {
  return Math.round(ms / 60000);
}


export async function gameReportRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate, requireMinRole('TRAINER')] };

  /**
   * Il client Prisma non conosce le colonne nuove finche' non lo si rigenera:
   * senza questo controllo la rotta muore con un "Cannot read properties of
   * undefined" che non dice a nessuno cosa fare.
   */
  function prismaReady(): boolean {
    const client = app.prisma as unknown as Record<string, unknown>;
    return Boolean(client.gameSession && client.gamePlayerEntry);
  }

  function notGenerated(reply: FastifyReply) {
    return reply.status(503).send({
      success: false,
      error: {
        code: 'PRISMA_CLIENT_OUTDATED',
        message: 'Il client Prisma non e\' aggiornato. Esegui `pnpm db:generate` e `pnpm db:push`, poi riavvia l\'API.',
      },
    });
  }

  // ─── Costruzione del payload ──────────────────────────

  async function buildReport(
    organizationId: string,
    userId: string,
    gameSessionId: string,
    locale: Locale,
  ): Promise<GameReportData> {
    const L = LABELS[locale];

    const session = await app.prisma.gameSession.findFirst({
      where: { id: gameSessionId, organizationId },
      include: {
        entries: {
          include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, photoUrl: true } } },
        },
        team: { select: { id: true, name: true, logoUrl: true } },
        calendarEvent: { select: { id: true, title: true, startTime: true, opponent: true, isHome: true, venue: true } },
      },
    });
    if (!session) throw Object.assign(new Error('Partita non trovata'), { code: 'GAME_NOT_FOUND' });
    if (session.status !== 'COMPLETED') {
      throw Object.assign(new Error('Il report si genera solo su partite completate'), { code: 'GAME_NOT_COMPLETED' });
    }

    const [org, user] = await Promise.all([
      app.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, logoUrl: true } }),
      app.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
    ]);

    const playedAt = session.calendarEvent?.startTime ?? session.completedAt ?? session.startedAt;
    const ourName = session.team?.name ?? org?.name ?? '—';
    const oppName = session.calendarEvent?.opponent?.trim() || '—';
    const isHome = session.calendarEvent?.isHome ?? null;
    // Casa prima, come sul tabellone. Senza indicazione si assume la casa:
    // e' il caso piu' frequente e non c'e' niente di meglio da indovinare.
    const homeTeamName = isHome === false ? oppName : ourName;
    const awayTeamName = isHome === false ? ourName : oppName;

    const totalPeriods = session.quarters + session.overtimes;
    const periodLabels = Array.from({ length: totalPeriods }, (_, i) => periodLabel(i + 1, session.quarters));

    // ── Media stagionale: partite precedenti della stessa squadra ──
    // Solo quelle prima di questa: includere le successive farebbe cambiare
    // il report di ottobre ogni volta che si gioca a marzo.
    const previous = await app.prisma.gameSession.findMany({
      where: {
        organizationId,
        status: 'COMPLETED',
        id: { not: session.id },
        ...(session.teamId ? { teamId: session.teamId } : {}),
        startedAt: { lt: session.startedAt },
      },
      select: { entries: { select: { athleteId: true, totalPlayingMs: true } } },
    });
    const prevMinutes = new Map<string, number[]>();
    for (const g of previous) {
      for (const e of g.entries) {
        if (e.totalPlayingMs <= 0) continue;
        const arr = prevMinutes.get(e.athleteId) ?? [];
        arr.push(minutesFromMs(e.totalPlayingMs));
        prevMinutes.set(e.athleteId, arr);
      }
    }

    // ── ACWR alla data della partita, partita inclusa ──
    const athleteIds = session.entries.map((e) => e.athleteId);
    const acwr = await acwrByAthlete(athleteIds, playedAt);

    // ── Righe giocatore ──
    const players: GameReportPlayer[] = session.entries
      .map((entry) => {
        const raw = Array.isArray(entry.stints) ? (entry.stints as unknown as StoredStint[]) : [];
        const stints: GameReportStint[] = raw
          .filter((st) => (st.durationMs ?? 0) > 0)
          .map((st) => {
            const q = st.quarter ?? 1;
            return {
              quarter: q,
              periodLabel: periodLabel(q, session.quarters),
              inMs: st.inMs ?? 0,
              outMs: st.outMs ?? 0,
              durationMs: st.durationMs ?? 0,
              breaks: st.breaks ?? 0,
            };
          })
          .sort((a, b) => a.quarter - b.quarter || a.inMs - b.inMs);

        const msByPeriod: Record<string, number> = {};
        for (const st of stints) {
          msByPeriod[String(st.quarter)] = (msByPeriod[String(st.quarter)] ?? 0) + st.durationMs;
        }

        const minutes = minutesFromMs(entry.totalPlayingMs);
        const rpe = entry.rpe ?? null;
        const prev = prevMinutes.get(entry.athleteId) ?? [];
        const seasonAvg = prev.length > 0
          ? Math.round((prev.reduce((a, b) => a + b, 0) / prev.length) * 10) / 10
          : null;
        const a = acwr.get(entry.athleteId);

        return {
          athleteId: entry.athleteId,
          athleteName: `${entry.athlete.lastName} ${entry.athlete.firstName}`.trim(),
          jerseyNumber: entry.athlete.jerseyNumber,
          photoUrl: entry.athlete.photoUrl,
          minutes,
          totalPlayingMs: entry.totalPlayingMs,
          msByPeriod,
          stints,
          stintCount: stints.length,
          breakCount: stints.reduce((n, st) => n + st.breaks, 0),
          rpe,
          load: rpe && minutes > 0 ? rpe * minutes : null,
          seasonAvgMinutes: seasonAvg,
          minutesDelta: seasonAvg != null ? Math.round((minutes - seasonAvg) * 10) / 10 : null,
          acwr: a?.acwr ?? null,
          acwrZone: a?.zone ?? null,
          readiness: entry.readiness ?? null,
          readinessNote: entry.readinessNote ?? null,
        };
      })
      // Chi ha giocato prima, per minuti; i DNP in coda ordinati per numero.
      .sort((x, y) =>
        (y.minutes - x.minutes) ||
        ((x.jerseyNumber ?? 999) - (y.jerseyNumber ?? 999)) ||
        x.athleteName.localeCompare(y.athleteName));

    const used = players.filter((p) => p.totalPlayingMs > 0);
    const withRpe = players.filter((p) => p.rpe != null);
    const summary = {
      playersUsed: used.length,
      playersDressed: players.length,
      totalMinutes: used.reduce((n, p) => n + p.minutes, 0),
      // Minuti-uomo teorici: ogni periodo cinque giocatori in campo.
      //
      // Un supplementare vale META' quarto — 10' diventano 5', come nel
      // regolamento FIBA. Il modello ha un solo `quarterDurationMs` e prima i
      // supplementari venivano contati come quarti interi: il denominatore si
      // gonfiava del 20%, e con due supplementari il riquadro arrivava a dire
      // "Minuti 316 / 300", cioe' piu' minuti giocati di quanti ne
      // esistessero. Una convenzione e non un campo nuovo: copre il caso reale
      // senza una migration, e la si cambia qui se un giorno servisse.
      expectedMinutes: Math.round(
        ((session.quarters * session.quarterDurationMs
          + session.overtimes * (session.quarterDurationMs / 2)) * 5) / 60000,
      ),
      avgRpe: withRpe.length > 0
        ? Math.round((withRpe.reduce((n, p) => n + (p.rpe ?? 0), 0) / withRpe.length) * 10) / 10
        : null,
      totalLoad: players.reduce((n, p) => n + (p.load ?? 0), 0),
      avgStintsPerPlayer: used.length > 0
        ? Math.round((used.reduce((n, p) => n + p.stintCount, 0) / used.length) * 10) / 10
        : null,
      totalBreaks: players.reduce((n, p) => n + p.breakCount, 0),
    };

    const dt = new Date(playedAt);
    const intlLocale = locale === 'it' ? 'it-IT' : locale === 'es' ? 'es-ES' : 'en-GB';

    return {
      kind: 'GAME',
      metadata: {
        audience: 'STAFF',
        organizationName: org?.name || '—',
        periodFrom: dt.toISOString().slice(0, 10),
        periodTo: dt.toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        generatedBy: user ? `${user.firstName} ${user.lastName}` : '—',
        logoUrl: session.team?.logoUrl || org?.logoUrl || undefined,
        teamName: session.team?.name ?? undefined,
      },
      gameSessionId: session.id,
      homeTeamName,
      awayTeamName,
      isHome,
      homeScore: session.homeScore ?? null,
      awayScore: session.awayScore ?? null,
      competition: session.competition ?? null,
      venue: session.calendarEvent?.venue ?? null,
      playedAt: dt.toISOString(),
      dateLabel: dt.toLocaleDateString(intlLocale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
      timeLabel: dt.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' }),
      quarters: session.quarters,
      overtimes: session.overtimes,
      quarterDurationMs: session.quarterDurationMs,
      periodLabels,
      players,
      summary,
      statusLabels: Object.fromEntries(Object.entries(STATUS_LABELS[locale]).map(([k, v]) => [k, v])),
      labels: L,
    };
  }

  /**
   * ACWR alla data della partita. La formula vive in @trainmind/utils, una
   * sola per tutto il prodotto. La partita e' inclusa,
   * perche' al completamento sono gia' nate le sue TrainingSession.
   */
  async function acwrByAthlete(
    athleteIds: string[],
    asOf: Date,
  ): Promise<Map<string, { acwr: number | null; zone: GameReportPlayer['acwrZone'] }>> {
    const out = new Map<string, { acwr: number | null; zone: GameReportPlayer['acwrZone'] }>();
    if (athleteIds.length === 0) return out;

    // Le sedute di squadra (athleteId nullo) valgono per tutta la rosa: la
    // regola sta in `acwrLoadPoints`, una sola volta per tutto il prodotto.
    const byAthlete = await acwrLoadPoints(app.prisma, athleteIds, asOf);

    for (const id of athleteIds) {
      const r = computeAcwr(byAthlete.get(id) ?? [], asOf);
      out.set(id, { acwr: r.acwr, zone: r.zone });
    }
    return out;
  }

  // ─── GET /game-report/list ────────────────────────────
  app.get('/game-report/list', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!prismaReady()) return notGenerated(reply);
    const schema = z.object({
      teamId: z.string().optional(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    });
    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Parametri non validi' } });
    }
    const { teamId, from, to, limit } = parsed.data;

    const rows = await app.prisma.gameSession.findMany({
      where: {
        organizationId: request.user.organizationId,
        // Solo partite chiuse: prima del fischio finale i minuti stanno ancora
        // correndo e il report sarebbe la foto di qualcosa in movimento.
        status: 'COMPLETED',
        ...(teamId ? { teamId } : {}),
        ...(from || to ? {
          startedAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
          },
        } : {}),
      },
      select: {
        id: true, calendarEventId: true, startedAt: true, completedAt: true, teamId: true,
        homeScore: true, awayScore: true, competition: true,
        team: { select: { name: true } },
        calendarEvent: { select: { title: true, startTime: true, opponent: true, isHome: true } },
        entries: { select: { totalPlayingMs: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    const data: GameReportListItem[] = rows.map((r) => ({
      gameSessionId: r.id,
      calendarEventId: r.calendarEventId,
      title: r.calendarEvent?.title ?? '—',
      playedAt: (r.calendarEvent?.startTime ?? r.completedAt ?? r.startedAt).toISOString(),
      teamId: r.teamId,
      teamName: r.team?.name ?? null,
      opponent: r.calendarEvent?.opponent ?? null,
      isHome: r.calendarEvent?.isHome ?? null,
      homeScore: r.homeScore ?? null,
      awayScore: r.awayScore ?? null,
      competition: r.competition ?? null,
      playersUsed: r.entries.filter((e) => e.totalPlayingMs > 0).length,
    }));

    return reply.send({ success: true, data });
  });

  // ─── GET /game-report/:id ─────────────────────────────
  app.get<{ Params: { id: string } }>('/game-report/:id', auth, async (request, reply) => {
    if (!prismaReady()) return notGenerated(reply);
    const locale = normalizeLocale((request.query as { locale?: string })?.locale);
    try {
      const report = await buildReport(request.user.organizationId, request.user.userId, request.params.id, locale);
      return reply.send({ success: true, data: { report } });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'GAME_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Partita non trovata' } });
      }
      if (code === 'GAME_NOT_COMPLETED') {
        return reply.status(409).send({
          success: false,
          error: { code: 'GAME_NOT_COMPLETED', message: 'Il report post-partita si genera solo su partite completate.' },
        });
      }
      throw err;
    }
  });

  // ─── PUT /game-report/:id/readiness ───────────────────
  app.put<{ Params: { id: string } }>('/game-report/:id/readiness', auth, async (request, reply) => {
    if (!prismaReady()) return notGenerated(reply);
    const schema = z.object({
      entries: z.array(z.object({
        athleteId: z.string().min(1),
        readiness: z.number().int().min(0).max(5).nullable().optional(),
        readinessNote: z.string().max(500).nullable().optional(),
      })).max(60),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }

    const session = await app.prisma.gameSession.findFirst({
      where: { id: request.params.id, organizationId: request.user.organizationId },
      select: { id: true, status: true },
    });
    if (!session) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Partita non trovata' } });
    }

    // updateMany e non upsert: le righe esistono gia' (le crea il foglio
    // partita), e una readiness su un atleta che non era a referto sarebbe
    // un dato senza minuti a cui riferirsi.
    await app.prisma.$transaction(
      parsed.data.entries.map((e) =>
        app.prisma.gamePlayerEntry.updateMany({
          where: { gameSessionId: session.id, athleteId: e.athleteId },
          data: {
            readiness: e.readiness ?? null,
            readinessNote: e.readinessNote?.trim() ? e.readinessNote.trim() : null,
          },
        }),
      ),
    );

    const locale = normalizeLocale((request.query as { locale?: string })?.locale);
    const report = await buildReport(request.user.organizationId, request.user.userId, session.id, locale);
    return reply.send({ success: true, data: { report } });
  });

  // ─── GET /game-report/:id/export ──────────────────────
  app.get<{ Params: { id: string } }>('/game-report/:id/export', auth, async (request, reply) => {
    if (!prismaReady()) return notGenerated(reply);
    const schema = z.object({
      format: z.enum(['PDF', 'DOCX']),
      locale: z.string().optional(),
    });
    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Formato non valido' } });
    }
    const locale = normalizeLocale(parsed.data.locale);

    let report: GameReportData;
    try {
      report = await buildReport(request.user.organizationId, request.user.userId, request.params.id, locale);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'GAME_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Partita non trovata' } });
      }
      if (code === 'GAME_NOT_COMPLETED') {
        return reply.status(409).send({
          success: false,
          error: { code: 'GAME_NOT_COMPLETED', message: 'Il report post-partita si genera solo su partite completate.' },
        });
      }
      throw err;
    }

    const slug = `${report.homeTeamName}-${report.awayTeamName}`
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const filename = `report-partita-${slug}-${report.playedAt.slice(0, 10)}.${parsed.data.format.toLowerCase()}`;

    try {
      const buffer = parsed.data.format === 'PDF'
        ? await renderGameReportPdf(report)
        : await renderGameReportDocx(report);
      reply.header('Content-Type', parsed.data.format === 'PDF'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      return reply.send(buffer);
    } catch (err) {
      request.log.error({ err }, 'Game report render failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'REPORT_FAILED', message: err instanceof Error ? err.message : 'Errore nella generazione del report' },
      });
    }
  });
}
