/**
 * Report post-partita — resa DOCX.
 *
 * Documento a se', come gli altri report specifici: la pagina e' un tabellone
 * piu' tabelle a celle colorate, non KPI e grafici generici. Condivide solo il
 * caricamento dinamico di `docx`, che resta una dipendenza facoltativa.
 *
 * Unita' di `docx`: i font sono in half-point (size: 18 = 9pt), le larghezze
 * in DXA (1 cm = 567 DXA).
 */

import type { GameReportData } from '@trainmind/types';
import type { ParagraphChild } from 'docx';

type DocxModule = typeof import('docx');
type D = DocxModule;

async function getDocx(): Promise<DocxModule> {
  try {
    return (await import('docx')) as unknown as DocxModule;
  } catch (err) {
    throw new Error(
      `Libreria 'docx' non installata. Esegui: pnpm add docx --filter @trainmind/api. Dettagli: ${String(err)}`,
    );
  }
}

const SLATE_900 = '0F172A';
const SLATE_700 = '334155';
const SLATE_500 = '64748B';
const SLATE_300 = 'CBD5E1';
const SLATE_200 = 'E2E8F0';
const SLATE_100 = 'F1F5F9';

const STATUS_FILL: Record<number, { bg: string; fg: string }> = {
  0: { bg: 'F2706E', fg: '4A1010' },
  1: { bg: 'F5945C', fg: '4A2410' },
  2: { bg: 'F7C45C', fg: '4A3410' },
  3: { bg: 'DFE06A', fg: '3F4210' },
  4: { bg: '93CF85', fg: '16401A' },
  5: { bg: '48BF8A', fg: '0B3D28' },
};

const ZONE_COLOR: Record<string, string> = {
  low: '0284C7', optimal: '059669', high: 'D97706', danger: 'DC2626',
};
const ZONE_LABEL_KEY: Record<string, string> = {
  low: 'zoneLow', optimal: 'zoneOptimal', high: 'zoneHigh', danger: 'zoneDanger',
};

function fmtMin(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Le immagini sono data URL nel database: qui servono i byte grezzi. */
function decodeImage(url: string | null | undefined): { data: Buffer; type: 'png' | 'jpg' | 'gif' } | null {
  if (!url) return null;
  const m = /^data:image\/(png|jpe?g|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(url);
  if (!m) return null;
  try {
    const kind = m[1].toLowerCase();
    return {
      data: Buffer.from(m[2].replace(/\s+/g, ''), 'base64'),
      type: kind === 'png' ? 'png' : kind === 'gif' ? 'gif' : 'jpg',
    };
  } catch {
    return null;
  }
}

function borders(d: D, color = SLATE_300) {
  const { BorderStyle } = d;
  const side = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: side, bottom: side, left: side, right: side };
}

function text(d: D, value: string, opts: { bold?: boolean; size?: number; color?: string; align?: 'left' | 'center' | 'right' } = {}) {
  const { Paragraph, TextRun, AlignmentType } = d;
  return new Paragraph({
    alignment: opts.align === 'center' ? AlignmentType.CENTER : opts.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
    children: [new TextRun({ text: value, bold: opts.bold, size: opts.size ?? 18, color: opts.color ?? SLATE_900 })],
  });
}

function cell(d: D, children: unknown[], opts: { fill?: string; width?: number } = {}) {
  const { TableCell, WidthType, ShadingType } = d;
  return new TableCell({
    borders: borders(d),
    shading: opts.fill ? { type: ShadingType.SOLID, color: opts.fill, fill: opts.fill } : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    // @ts-expect-error docx accetta Paragraph e Table indifferentemente
    children,
  });
}

function fullTable(d: D, rows: unknown[]) {
  const { Table, WidthType } = d;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    // @ts-expect-error docx accetta le righe costruite qui sopra
    rows,
  });
}

// ─── Sezioni ────────────────────────────────────────────

function makeScoreboard(d: D, r: GameReportData) {
  const { Paragraph, TextRun, AlignmentType, ImageRun } = d;
  const out: unknown[] = [];
  const logo = decodeImage(r.metadata.logoUrl);

  if (logo) {
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({
        data: logo.data,
        type: logo.type,
        transformation: { width: 90, height: 56 },
      })],
    }));
  }

  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: r.labels.reportTitle, bold: true, size: 32, color: SLATE_900 })],
  }));

  const score = r.homeScore != null && r.awayScore != null ? `${r.homeScore} - ${r.awayScore}` : '—';
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: `${r.homeTeamName}   ${score}   ${r.awayTeamName}`, bold: true, size: 28, color: SLATE_900 })],
  }));

  const sub = [
    r.dateLabel,
    r.timeLabel,
    r.venue ?? '',
    r.competition ?? '',
  ].filter(Boolean).join(' · ');
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: sub, size: 20, color: SLATE_700 })],
  }));
  return out;
}

function makeReadiness(d: D, r: GameReportData) {
  const { TableRow, Paragraph, TextRun, ImageRun, AlignmentType } = d;
  const out: unknown[] = [];
  out.push(text(d, r.labels.readinessTitle, { bold: true, size: 26 }));

  if (r.players.length === 0) {
    out.push(text(d, r.labels.noPlayers, { size: 16, color: SLATE_500 }));
    return out;
  }

  // Legenda 0-5, come sul foglio cartaceo.
  out.push(fullTable(d, [5, 4, 3, 2, 1, 0].map((n) => {
    const c = STATUS_FILL[n];
    return new TableRow({
      children: [
        cell(d, [text(d, String(n), { bold: true, color: c.fg, align: 'center', size: 16 })], { fill: c.bg, width: 700 }),
        cell(d, [text(d, r.statusLabels[String(n)] ?? '', { size: 16 })], { width: 8600 }),
      ],
    });
  })));
  out.push(text(d, ' ', { size: 10 }));

  const header = new TableRow({
    tableHeader: true,
    children: [
      cell(d, [text(d, r.labels.player, { bold: true, color: SLATE_700 })], { fill: SLATE_200, width: 3800 }),
      cell(d, [text(d, r.labels.minutes, { bold: true, color: SLATE_700, align: 'center' })], { fill: SLATE_200, width: 900 }),
      cell(d, [text(d, r.labels.trainingExpectation, { bold: true, color: SLATE_700, align: 'center' })], { fill: SLATE_200, width: 1500 }),
      cell(d, [text(d, r.labels.notes, { bold: true, color: SLATE_700 })], { fill: SLATE_200 }),
    ],
  });

  const rows = r.players.map((p) => {
    const c = p.readiness != null ? STATUS_FILL[p.readiness] : null;
    const photo = decodeImage(p.photoUrl);
    const nameRuns: ParagraphChild[] = [];
    if (photo) {
      nameRuns.push(new ImageRun({
        data: photo.data,
        type: photo.type,
        transformation: { width: 20, height: 20 },
      }));
      nameRuns.push(new TextRun({ text: '  ', size: 18 }));
    }
    if (p.jerseyNumber != null) {
      nameRuns.push(new TextRun({ text: `${p.jerseyNumber}  `, bold: true, size: 15, color: SLATE_500 }));
    }
    nameRuns.push(new TextRun({ text: p.athleteName, bold: true, size: 18, color: SLATE_900 }));

    return new TableRow({
      children: [
        cell(d, [new Paragraph({ alignment: AlignmentType.LEFT, children: nameRuns })]),
        cell(d, [text(d, p.totalPlayingMs > 0 ? fmtMin(p.totalPlayingMs) : r.labels.dnp, { align: 'center', size: 17 })]),
        cell(d, [text(d, p.readiness != null ? String(p.readiness) : '', {
          bold: true, size: 22, color: c?.fg ?? SLATE_900, align: 'center',
        })], c ? { fill: c.bg } : {}),
        cell(d, [text(d, p.readinessNote ?? '', { size: 16 })]),
      ],
    });
  });

  out.push(fullTable(d, [header, ...rows]));
  return out;
}

function makeSummary(d: D, r: GameReportData) {
  const { TableRow } = d;
  const s = r.summary;
  const pairs: Array<[string, string]> = [
    [r.labels.playersUsed, `${s.playersUsed} / ${s.playersDressed}`],
    [r.labels.totalMinutes, `${s.totalMinutes} / ${s.expectedMinutes}`],
    [r.labels.avgRpe, s.avgRpe != null ? String(s.avgRpe) : '—'],
    [r.labels.totalLoad, s.totalLoad > 0 ? String(s.totalLoad) : '—'],
    [r.labels.avgStints, s.avgStintsPerPlayer != null ? String(s.avgStintsPerPlayer) : '—'],
    [r.labels.totalBreaks, String(s.totalBreaks)],
  ];
  const out: unknown[] = [];
  out.push(text(d, ' ', { size: 10 }));
  out.push(text(d, r.labels.summaryTitle, { bold: true, size: 26 }));
  out.push(fullTable(d, pairs.map(([k, v]) => new TableRow({
    children: [
      cell(d, [text(d, k, { color: SLATE_700 })], { fill: SLATE_100, width: 5000 }),
      cell(d, [text(d, v, { bold: true })]),
    ],
  }))));
  return out;
}

function makeLoad(d: D, r: GameReportData) {
  const rows = r.players.filter((p) => p.totalPlayingMs > 0);
  if (rows.length === 0) return [];
  const { TableRow } = d;
  const out: unknown[] = [];
  out.push(text(d, ' ', { size: 10 }));
  out.push(text(d, r.labels.loadTitle, { bold: true, size: 26 }));

  const heads = [r.labels.player, r.labels.minutes, r.labels.rpe, r.labels.load, r.labels.seasonAvg, r.labels.delta, r.labels.acwr, ''];
  const header = new TableRow({
    tableHeader: true,
    children: heads.map((h, i) =>
      cell(d, [text(d, h, { bold: true, color: SLATE_700, size: 15, align: i === 0 || i === 7 ? 'left' : 'right' })], { fill: SLATE_200 })),
  });

  const body = rows.map((p) => {
    const zc = p.acwrZone ? ZONE_COLOR[p.acwrZone] : SLATE_900;
    const delta = p.minutesDelta;
    return new TableRow({
      children: [
        cell(d, [text(d, p.athleteName, { size: 16 })]),
        cell(d, [text(d, String(p.minutes), { size: 16, align: 'right' })]),
        cell(d, [text(d, p.rpe != null ? String(p.rpe) : '—', { size: 16, align: 'right' })]),
        cell(d, [text(d, p.load != null ? String(p.load) : '—', { size: 16, align: 'right' })]),
        cell(d, [text(d, p.seasonAvgMinutes != null ? String(p.seasonAvgMinutes) : '—', { size: 16, align: 'right' })]),
        cell(d, [text(d, delta == null ? '' : `${delta > 0 ? '+' : ''}${delta}`, {
          size: 16, align: 'right',
          color: delta == null || delta === 0 ? SLATE_900 : delta > 0 ? '059669' : 'DC2626',
        })]),
        cell(d, [text(d, p.acwr != null ? String(p.acwr) : '—', { size: 16, align: 'right', bold: true, color: zc })]),
        cell(d, [text(d, p.acwrZone ? r.labels[ZONE_LABEL_KEY[p.acwrZone]] ?? '' : '', { size: 14, color: zc })]),
      ],
    });
  });

  body.push(new TableRow({
    children: [
      cell(d, [text(d, r.labels.total, { bold: true, size: 16 })], { fill: SLATE_100 }),
      cell(d, [text(d, String(r.summary.totalMinutes), { bold: true, size: 16, align: 'right' })], { fill: SLATE_100 }),
      cell(d, [text(d, r.summary.avgRpe != null ? String(r.summary.avgRpe) : '—', { bold: true, size: 16, align: 'right' })], { fill: SLATE_100 }),
      cell(d, [text(d, r.summary.totalLoad > 0 ? String(r.summary.totalLoad) : '—', { bold: true, size: 16, align: 'right' })], { fill: SLATE_100 }),
      cell(d, [text(d, '')], { fill: SLATE_100 }),
      cell(d, [text(d, '')], { fill: SLATE_100 }),
      cell(d, [text(d, '')], { fill: SLATE_100 }),
      cell(d, [text(d, '')], { fill: SLATE_100 }),
    ],
  }));

  out.push(fullTable(d, [header, ...body]));
  return out;
}

function makeStints(d: D, r: GameReportData) {
  const played = r.players.filter((p) => p.stints.length > 0);
  if (played.length === 0) return [];
  const { TableRow, Paragraph, PageBreak } = d;
  const out: unknown[] = [];
  out.push(new Paragraph({ children: [new PageBreak()] }));
  out.push(text(d, r.labels.stintsTitle, { bold: true, size: 30 }));

  // Minuti per periodo
  out.push(text(d, r.labels.stintsPerPeriod, { bold: true, size: 22 }));
  const phead = new TableRow({
    tableHeader: true,
    children: [
      cell(d, [text(d, r.labels.player, { bold: true, color: SLATE_700, size: 15 })], { fill: SLATE_200 }),
      ...r.periodLabels.map((l) => cell(d, [text(d, l, { bold: true, color: SLATE_700, size: 15, align: 'right' })], { fill: SLATE_200 })),
      cell(d, [text(d, r.labels.total, { bold: true, color: SLATE_700, size: 15, align: 'right' })], { fill: SLATE_200 }),
    ],
  });
  const prows = played.map((p) => new TableRow({
    children: [
      cell(d, [text(d, p.athleteName, { size: 15 })]),
      ...r.periodLabels.map((_, i) => {
        const ms = p.msByPeriod[String(i + 1)] ?? 0;
        return cell(d, [text(d, ms > 0 ? fmtMin(ms) : '', { size: 15, align: 'right' })]);
      }),
      cell(d, [text(d, fmtMin(p.totalPlayingMs), { size: 15, align: 'right', bold: true })]),
    ],
  }));
  out.push(fullTable(d, [phead, ...prows]));
  out.push(text(d, ' ', { size: 10 }));

  // Dettaglio turni
  out.push(text(d, r.labels.stintDetail, { bold: true, size: 22 }));
  const shead = new TableRow({
    tableHeader: true,
    children: [r.labels.player, r.labels.stint, r.labels.stintCount, r.labels.breaks].map((h, i) =>
      cell(d, [text(d, h, { bold: true, color: SLATE_700, size: 15, align: i >= 2 ? 'right' : 'left' })], { fill: SLATE_200 })),
  });
  const srows = played.map((p) => new TableRow({
    children: [
      cell(d, [text(d, p.athleteName, { size: 15 })], { width: 2600 }),
      cell(d, [text(d, p.stints.map((st, i) =>
        `${i + 1}. ${st.periodLabel} ${fmtMin(st.durationMs)}${st.breaks > 0 ? ` (${st.breaks})` : ''}`,
      ).join('   '), { size: 14 })]),
      cell(d, [text(d, String(p.stintCount), { size: 15, align: 'right' })], { width: 800 }),
      cell(d, [text(d, String(p.breakCount), { size: 15, align: 'right' })], { width: 900 }),
    ],
  }));
  out.push(fullTable(d, [shead, ...srows]));
  return out;
}

// ─── Entry point ────────────────────────────────────────

export async function renderGameReportDocx(report: GameReportData): Promise<Buffer> {
  const d = await getDocx();
  const { Document, Packer, Footer, Paragraph, TextRun, AlignmentType, PageNumber } = d;

  const children: unknown[] = [
    ...makeScoreboard(d, report),
    ...makeReadiness(d, report),
    ...makeSummary(d, report),
    ...makeLoad(d, report),
    ...makeStints(d, report),
  ];

  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${report.homeTeamName} - ${report.awayTeamName} · ${report.playedAt.slice(0, 10)} · ${report.labels.generatedBy} ${report.metadata.generatedBy} · `,
          size: 14, color: SLATE_500,
        }),
        new TextRun({ children: [PageNumber.CURRENT], size: 14, color: SLATE_500 }),
        new TextRun({ text: '/', size: 14, color: SLATE_500 }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: SLATE_500 }),
      ],
    })],
  });

  const doc = new Document({
    creator: 'TrainMind',
    title: `${report.labels.reportTitle} - ${report.homeTeamName} vs ${report.awayTeamName}`,
    description: `Report post-partita ${report.playedAt.slice(0, 10)}`,
    styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } },
    sections: [{
      properties: { page: { margin: { top: 700, right: 700, bottom: 900, left: 700 } } },
      // @ts-expect-error docx accetta Paragraph e Table indifferentemente
      children,
      footers: { default: footer },
    }],
  });

  const uint8 = await Packer.toBuffer(doc);
  return Buffer.from(uint8);
}
