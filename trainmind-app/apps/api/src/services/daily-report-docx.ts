/**
 * Report giornaliero — resa DOCX.
 *
 * Documento a se': il report engine costruisce KPI/tabelle/grafici generici,
 * qui invece la pagina E' una tabella con celle colorate e foto. Condivide
 * solo il caricamento dinamico di `docx`, che resta una dipendenza
 * facoltativa (l'API parte anche senza, ed e' il download a fallire con un
 * messaggio che dice cosa installare).
 *
 * Nota sulle unita': `docx` usa half-point per i font (size: 18 = 9pt) e DXA
 * per le larghezze (1 cm = 567 DXA).
 */

import type { DailyReportData, DailyDensitySection } from '@trainmind/types';
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

/** Stessa scala di colori della legenda cartacea, senza il cancelletto. */
const STATUS_FILL: Record<number, { bg: string; fg: string }> = {
  0: { bg: 'F2706E', fg: '4A1010' },
  1: { bg: 'F5945C', fg: '4A2410' },
  2: { bg: 'F7C45C', fg: '4A3410' },
  3: { bg: 'DFE06A', fg: '3F4210' },
  4: { bg: '93CF85', fg: '16401A' },
  5: { bg: '48BF8A', fg: '0B3D28' },
};

const BAND_LABEL_KEY: Record<DailyDensitySection['densityBand'], string> = {
  LOW: 'bandLow', MEDIUM: 'bandMedium', HIGH: 'bandHigh', VERY_HIGH: 'bandVeryHigh',
};

function fmtMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}min ${total % 60}s`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

/** Le foto sono data URL nel database: qui servono i byte grezzi. */
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

function makeHeader(d: D, r: DailyReportData) {
  const { Paragraph, TextRun, AlignmentType, ImageRun } = d;
  const out: unknown[] = [];
  const logo = decodeImage(r.metadata.logoUrl);

  if (logo) {
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({
        data: logo.data,
        type: logo.type,
        transformation: { width: 96, height: 60 },
      })],
    }));
  }

  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: r.labels.reportTitle, bold: true, size: 34, color: SLATE_900 })],
  }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({
      text: `${r.weekdayLabel} · ${fmtDate(r.date)}${r.metadata.teamName ? ` · ${r.metadata.teamName}` : ''}`,
      size: 22, color: SLATE_700,
    })],
  }));
  return out;
}

function makeActivitiesAndLegend(d: D, r: DailyReportData) {
  const { TableRow } = d;
  const out: unknown[] = [];

  out.push(text(d, r.labels.activities, { bold: true, size: 22 }));
  const actRows = r.activities.length > 0
    ? r.activities.map((a) => new TableRow({
        children: [
          cell(d, [text(d, a.label)], { width: 8100 }),
          cell(d, [text(d, `${a.minutes}'`, { bold: true, align: 'right' })], { width: 1200 }),
        ],
      }))
    : [new TableRow({ children: [cell(d, [text(d, '—', { color: SLATE_500 })]), cell(d, [text(d, '')], { width: 1200 })] })];
  out.push(fullTable(d, actRows));

  out.push(text(d, ' ', { size: 10 }));
  const legendRows = [5, 4, 3, 2, 1, 0].map((n) => {
    const c = STATUS_FILL[n];
    return new TableRow({
      // Larghezza esplicita su ENTRAMBE le celle: dandola a una sola, Word e
      // LibreOffice si dividono il resto a meta' e il numero diventa una
      // colonna larga quanto l'etichetta.
      children: [
        cell(d, [text(d, String(n), { bold: true, color: c.fg, align: 'center' })], { fill: c.bg, width: 700 }),
        cell(d, [text(d, r.statusLabels[String(n)] ?? '')], { width: 8600 }),
      ],
    });
  });
  out.push(fullTable(d, legendRows));
  return out;
}

function makePlayers(d: D, r: DailyReportData) {
  const { TableRow, Paragraph, TextRun, ImageRun, AlignmentType } = d;
  const out: unknown[] = [];
  out.push(text(d, ' ', { size: 10 }));

  const header = new TableRow({
    tableHeader: true,
    children: [
      cell(d, [text(d, r.labels.player, { bold: true, color: SLATE_700 })], { fill: SLATE_200, width: 4200 }),
      cell(d, [text(d, r.labels.status, { bold: true, color: SLATE_700, align: 'center' })], { fill: SLATE_200, width: 1000 }),
      cell(d, [text(d, r.labels.notes, { bold: true, color: SLATE_700 })], { fill: SLATE_200 }),
    ],
  });

  const rows = r.entries.map((e) => {
    const c = STATUS_FILL[e.status] ?? STATUS_FILL[5];
    const photo = decodeImage(e.photoUrl);
    const nameRuns: ParagraphChild[] = [];
    if (photo) {
      nameRuns.push(new ImageRun({
        data: photo.data,
        type: photo.type,
        transformation: { width: 22, height: 22 },
      }));
      nameRuns.push(new TextRun({ text: '  ', size: 18 }));
    }
    if (e.jerseyNumber != null) {
      nameRuns.push(new TextRun({ text: `${e.jerseyNumber}  `, bold: true, size: 16, color: SLATE_500 }));
    }
    nameRuns.push(new TextRun({ text: e.athleteName, bold: true, size: 18, color: SLATE_900 }));

    return new TableRow({
      children: [
        cell(d, [new Paragraph({ alignment: AlignmentType.LEFT, children: nameRuns })]),
        cell(d, [text(d, String(e.status), { bold: true, size: 22, color: c.fg, align: 'center' })], { fill: c.bg }),
        cell(d, [text(d, e.note ?? '', { size: 16 })]),
      ],
    });
  });

  out.push(fullTable(d, [header, ...rows.length ? rows : [
    new TableRow({ children: [cell(d, [text(d, '—', { color: SLATE_500 })]), cell(d, [text(d, '')]), cell(d, [text(d, '')])] }),
  ]]));
  return out;
}

/** Le nove colonne cliniche, nell'ordine del foglio cartaceo. */
const CLINICAL_KEYS = [
  'nextTraining', 'injuryType', 'bodyPart', 'side',
  'clinicalStatus', 'taping', 'treatment', 'trainingType', 'forecast',
] as const;

const NEXT_TRAINING_FILL: Record<string, string> = {
  available: 'C9EFD8', partial: 'FDF0C2', unavailable: 'FBD3D1',
};

function vocab(r: DailyReportData, field: string, code: string | null | undefined): string {
  if (!code) return '';
  return r.vocabLabels?.[field]?.[code] ?? code;
}

function makeClinical(d: D, r: DailyReportData) {
  const rowsWith = r.entries.filter((e) => CLINICAL_KEYS.some((k) => e.clinical?.[k]));
  // Tabella da dieci colonne: si stampa solo se qualcuno l'ha compilata,
  // altrimenti sono dieci intestazioni su righe vuote.
  if (rowsWith.length === 0) return [];
  const { TableRow } = d;
  const out: unknown[] = [];
  out.push(text(d, ' ', { size: 10 }));
  out.push(text(d, r.labels.clinicalSection, { bold: true, size: 26 }));

  const heads = ['player', 'nextTraining', 'injury', 'bodyPart', 'side', 'clinicalStatus', 'taping', 'treatment', 'trainingType', 'forecast'];
  const header = new TableRow({
    tableHeader: true,
    children: heads.map((k) =>
      cell(d, [text(d, r.labels[k] ?? k, { bold: true, size: 12, color: SLATE_700 })], { fill: SLATE_200 })),
  });

  const rows = rowsWith.map((e) => new TableRow({
    children: [
      cell(d, [text(d, e.athleteName, { bold: true, size: 12 })]),
      ...CLINICAL_KEYS.map((k) => {
        const value = vocab(r, k, e.clinical?.[k]);
        const fill = k === 'nextTraining' && e.clinical?.nextTraining
          ? NEXT_TRAINING_FILL[e.clinical.nextTraining]
          : undefined;
        return cell(d, [text(d, value, { size: 12 })], fill ? { fill } : {});
      }),
    ],
  }));

  out.push(fullTable(d, [header, ...rows]));
  return out;
}

function makeTeamLines(d: D, r: DailyReportData) {
  const { TableRow } = d;
  const out: unknown[] = [];
  out.push(text(d, ' ', { size: 10 }));
  out.push(fullTable(d, [
    new TableRow({ children: [cell(d, [text(d, r.labels.teamLines, { bold: true, color: SLATE_700 })], { fill: SLATE_200 })] }),
    new TableRow({
      children: [cell(d, (r.teamLines ?? '').split('\n').map((line) => text(d, line || ' ', { size: 18 })))],
    }),
  ]));
  return out;
}

function makeLoad(d: D, r: DailyReportData) {
  if (r.load.length === 0) {
    return [
      text(d, ' ', { size: 10 }),
      text(d, r.labels.loadSummary, { bold: true, size: 26 }),
      text(d, r.labels.noLoad, { size: 16, color: SLATE_500 }),
    ];
  }
  const { TableRow } = d;
  const srcLabel: Record<string, string> = {
    TRAINING: r.labels.sourceTraining, GAME: r.labels.sourceGame, MIXED: r.labels.sourceMixed,
  };
  const out: unknown[] = [];
  out.push(text(d, ' ', { size: 10 }));
  out.push(text(d, r.labels.loadSummary, { bold: true, size: 26 }));

  const header = new TableRow({
    tableHeader: true,
    children: [r.labels.player, r.labels.minutes, r.labels.rpe, r.labels.load, r.labels.source].map((h, i) =>
      cell(d, [text(d, h, { bold: true, color: SLATE_700, align: i === 0 || i === 4 ? 'left' : 'right' })], { fill: SLATE_200 })),
  });
  const rows = r.load.map((l) => new TableRow({
    children: [
      cell(d, [text(d, l.athleteName)]),
      cell(d, [text(d, String(l.minutes), { align: 'right' })]),
      cell(d, [text(d, l.rpe != null ? String(l.rpe) : '—', { align: 'right' })]),
      cell(d, [text(d, l.load != null ? String(l.load) : '—', { align: 'right' })]),
      cell(d, [text(d, srcLabel[l.source] ?? l.source)]),
    ],
  }));
  const totalLoad = r.load.reduce((a, l) => a + (l.load ?? 0), 0);
  rows.push(new TableRow({
    children: [
      cell(d, [text(d, r.labels.total, { bold: true })], { fill: SLATE_100 }),
      cell(d, [text(d, '')], { fill: SLATE_100 }),
      cell(d, [text(d, '')], { fill: SLATE_100 }),
      cell(d, [text(d, String(totalLoad), { bold: true, align: 'right' })], { fill: SLATE_100 }),
      cell(d, [text(d, '')], { fill: SLATE_100 }),
    ],
  }));
  out.push(fullTable(d, [header, ...rows]));
  return out;
}

function makeDensity(d: D, r: DailyReportData) {
  const { TableRow, Paragraph, PageBreak } = d;
  const out: unknown[] = [];
  out.push(new Paragraph({ children: [new PageBreak()] }));
  out.push(text(d, r.labels.density, { bold: true, size: 30 }));
  // Vedi il commento gemello nel renderer PDF: la sezione resta, con scritto
  // perche' e' vuota.
  if (r.density.length === 0) {
    out.push(text(d, r.labels.noDensity, { size: 16, color: SLATE_500 }));
    return out;
  }

  for (const s of r.density) {
    out.push(text(d, `${s.title}${s.gameDayLabel ? ` · ${s.gameDayLabel}` : ''}`, { bold: true, size: 24 }));
    out.push(text(d,
      `${s.timeRange ? `${s.timeRange} · ` : ''}${s.athletesAvailable} ${r.labels.athletes} · ${fmtMs(s.totalMs)}`,
      { size: 16, color: SLATE_500 }));

    const densityRows = [
      new TableRow({
        tableHeader: true,
        children: [r.labels.densityTable, r.labels.duration, '%'].map((h) =>
          cell(d, [text(d, h, { bold: true, color: SLATE_700 })], { fill: SLATE_200 })),
      }),
      new TableRow({ children: [
        cell(d, [text(d, r.labels.activeTime)]),
        cell(d, [text(d, fmtMs(s.activeMs), { align: 'right' })]),
        cell(d, [text(d, `${s.densityPct}%`, { align: 'right' })]),
      ] }),
      new TableRow({ children: [
        cell(d, [text(d, r.labels.totalTime)]),
        cell(d, [text(d, fmtMs(s.totalMs), { align: 'right' })]),
        cell(d, [text(d, '')]),
      ] }),
      new TableRow({ children: [
        cell(d, [text(d, r.labels.pauseTime)]),
        cell(d, [text(d, fmtMs(s.pauseMs), { align: 'right' })]),
        cell(d, [text(d, `${100 - s.densityPct}%`, { align: 'right' })]),
      ] }),
      new TableRow({ children: [
        cell(d, [text(d, r.labels.density, { bold: true })], { fill: SLATE_100 }),
        cell(d, [text(d, r.labels[BAND_LABEL_KEY[s.densityBand]] ?? '', { bold: true })], { fill: SLATE_100 }),
        cell(d, [text(d, '')], { fill: SLATE_100 }),
      ] }),
    ];
    out.push(fullTable(d, densityRows));
    out.push(text(d, ' ', { size: 10 }));

    const drillHeader = new TableRow({
      tableHeader: true,
      children: [r.labels.drill, r.labels.totalTime, r.labels.perPlayer, r.labels.workOnly].map((h, i) =>
        cell(d, [text(d, h, { bold: true, color: SLATE_700, size: 16, align: i === 0 ? 'left' : 'right' })], { fill: SLATE_200 })),
    });
    const drillRows = s.drills.map((x) => new TableRow({
      children: [
        cell(d, [text(d, x.name, { size: 16 })]),
        cell(d, [text(d, fmtMs(x.totalMs), { size: 16, align: 'right' })]),
        cell(d, [text(d, x.perPlayerMs != null ? fmtMs(x.perPlayerMs) : '', { size: 16, align: 'right' })]),
        cell(d, [text(d, x.workMs != null ? fmtMs(x.workMs) : '', { size: 16, align: 'right' })]),
      ],
    }));
    drillRows.push(new TableRow({
      children: [
        cell(d, [text(d, r.labels.total, { bold: true, size: 16 })], { fill: SLATE_100 }),
        cell(d, [text(d, fmtMs(s.totalMs), { bold: true, size: 16, align: 'right' })], { fill: SLATE_100 }),
        cell(d, [text(d, fmtMs(s.activeMs), { bold: true, size: 16, align: 'right' })], { fill: SLATE_100 }),
        cell(d, [text(d, fmtMs(s.drills.reduce((a, x) => a + (x.workMs ?? 0), 0)), { bold: true, size: 16, align: 'right' })], { fill: SLATE_100 }),
      ],
    }));
    out.push(fullTable(d, [drillHeader, ...drillRows]));
    out.push(text(d, ' ', { size: 10 }));
  }
  return out;
}

// ─── Entry point ────────────────────────────────────────

export async function renderDailyReportDocx(report: DailyReportData): Promise<Buffer> {
  const d = await getDocx();
  const { Document, Packer, Footer, Paragraph, TextRun, AlignmentType, PageNumber } = d;

  const children: unknown[] = [
    ...makeHeader(d, report),
    ...makeActivitiesAndLegend(d, report),
    ...makePlayers(d, report),
    ...makeTeamLines(d, report),
    ...makeClinical(d, report),
    ...makeLoad(d, report),
    ...makeDensity(d, report),
  ];

  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${report.metadata.organizationName}${report.metadata.teamName ? ` · ${report.metadata.teamName}` : ''} · ${fmtDate(report.date)} · ${report.labels.generatedBy} ${report.metadata.generatedBy} · `,
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
    title: `${report.labels.reportTitle} - ${report.metadata.teamName ?? report.metadata.organizationName} - ${report.date}`,
    description: `Report giornaliero ${report.date}`,
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
