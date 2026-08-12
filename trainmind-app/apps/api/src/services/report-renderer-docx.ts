/**
 * DOCX Report Renderer - Sprint 4.1.4
 *
 * Renders a ReportData object to a Word document (.docx) buffer
 * using the `docx` npm library (no external Office runtime required).
 *
 * Strategy:
 *   1. Dynamic import of `docx` so build doesn't break if missing
 *   2. Compose sections using Document > Paragraph/Table primitives
 *   3. Charts are rendered as SVG → not natively supported by docx; we
 *      represent them as a summary table of data points (line/bar/area)
 *      plus a caption. This preserves information fidelity without
 *      requiring a headless-browser screenshot pipeline.
 *   4. Distribution bars (ACWR) rendered as a 4-row summary table with
 *      colored shading cells (using the Table cell shading API).
 */

import type {
  ReportData,
  StaffReportData,
  MedicalReportData,
  TrainerReportData,
  ReportKPI,
  ReportTable,
  ReportChart,
  ReportMetadata,
} from '@trainmind/types';

// We avoid a static import so TS doesn't fail if the dep is not yet installed.
// Install with: pnpm add docx --filter @trainmind/api
type DocxModule = typeof import('docx');

async function getDocx(): Promise<DocxModule> {
  try {
    return (await import('docx')) as unknown as DocxModule;
  } catch (err) {
    throw new Error(
      `Libreria 'docx' non installata. Esegui: pnpm add docx --filter @trainmind/api. Dettagli: ${String(err)}`,
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TEAL = '0F766E';
const SLATE_700 = '334155';
const SLATE_500 = '64748B';
const SLATE_200 = 'E2E8F0';
const SLATE_100 = 'F1F5F9';
const GREEN = '10B981';
const AMBER = 'F59E0B';
const RED = 'EF4444';
const BLUE = '0EA5E9';

// ─── Document building (all helpers take the dynamic `docx` module) ──

type D = DocxModule;

function makeHeader(d: D, metadata: ReportMetadata, audienceLabel: string) {
  const {
    Paragraph,
    TextRun,
    HeadingLevel,
    BorderStyle,
  } = d;

  const badge = new Paragraph({
    children: [
      new TextRun({
        text: audienceLabel.toUpperCase(),
        bold: true,
        size: 18,
        color: TEAL,
      }),
    ],
    spacing: { after: 80 },
  });

  const title = new Paragraph({
    text: metadata.organizationName,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 80 },
  });

  const sections: unknown[] = [];
  if (metadata.teamName) {
    sections.push(new Paragraph({
      children: [
        new TextRun({
          text: `Squadra: ${metadata.teamName}`,
          bold: true,
          color: TEAL,
          size: 22,
        }),
      ],
      spacing: { after: 60 },
    }));
  }

  const period = new Paragraph({
    children: [
      new TextRun({
        text: `Report periodico · ${formatDate(metadata.periodFrom)} — ${formatDate(metadata.periodTo)}`,
        color: SLATE_500,
        size: 20,
      }),
    ],
    spacing: { after: 80 },
  });

  const generated = new Paragraph({
    children: [
      new TextRun({
        text: `Generato il ${formatDate(metadata.generatedAt)} da ${metadata.generatedBy} · TrainMind`,
        color: SLATE_500,
        size: 18,
        italics: true,
      }),
    ],
    border: {
      bottom: { color: TEAL, space: 4, style: BorderStyle.SINGLE, size: 18 },
    },
    spacing: { after: 240 },
  });

  return [badge, title, ...sections, period, generated];
}

function makeH2(d: D, text: string) {
  const { Paragraph, HeadingLevel } = d;
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
  });
}

function makeH3(d: D, text: string) {
  const { Paragraph, HeadingLevel } = d;
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
  });
}

function makeSummaryBox(d: D, summary: string) {
  const { Paragraph, TextRun, BorderStyle, ShadingType } = d;
  return new Paragraph({
    children: [new TextRun({ text: summary, size: 22 })],
    shading: { type: ShadingType.SOLID, color: 'F0FDFA', fill: 'F0FDFA' },
    border: {
      left: { color: TEAL, space: 4, style: BorderStyle.SINGLE, size: 24 },
    },
    spacing: { before: 120, after: 240 },
    indent: { left: 200 },
  });
}

function severityColor(s?: ReportKPI['severity']): string {
  switch (s) {
    case 'success':
      return GREEN;
    case 'warning':
      return AMBER;
    case 'danger':
      return RED;
    default:
      return BLUE;
  }
}

function makeKpiTable(d: D, kpis: ReportKPI[]) {
  const {
    Table,
    TableRow,
    TableCell,
    Paragraph,
    TextRun,
    WidthType,
    BorderStyle,
    ShadingType,
  } = d;

  if (!kpis.length) {
    return new Paragraph({
      children: [
        new TextRun({
          text: 'Nessun KPI disponibile per il periodo.',
          italics: true,
          color: SLATE_500,
        }),
      ],
    });
  }

  // Chunk into rows of 4
  const rowsOfCards: ReportKPI[][] = [];
  for (let i = 0; i < kpis.length; i += 4) {
    rowsOfCards.push(kpis.slice(i, i + 4));
  }

  const border = {
    top: { style: BorderStyle.SINGLE, size: 6, color: SLATE_200 },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: SLATE_200 },
    left: { style: BorderStyle.SINGLE, size: 6, color: SLATE_200 },
    right: { style: BorderStyle.SINGLE, size: 6, color: SLATE_200 },
  };

  const tableRows = rowsOfCards.map((row) => {
    // Pad to 4 columns
    const padded = [...row];
    while (padded.length < 4) padded.push({ label: '', value: '' });

    return new TableRow({
      children: padded.map((k) => {
        const color = severityColor(k.severity);
        const hasContent = !!k.label;
        return new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: border,
          shading: hasContent
            ? { type: ShadingType.SOLID, color: 'FFFFFF', fill: 'FFFFFF' }
            : undefined,
          children: hasContent
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: k.label.toUpperCase(),
                      size: 14,
                      color: SLATE_500,
                      bold: true,
                    }),
                  ],
                  spacing: { after: 40 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(k.value),
                      size: 32,
                      bold: true,
                      color: '0F172A',
                    }),
                  ],
                  spacing: { after: 20 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: k.delta ? `${trendArrow(k.trend)} ${k.delta}` : ' ',
                      size: 16,
                      color,
                    }),
                  ],
                }),
              ]
            : [new Paragraph({ text: '' })],
        });
      }),
    });
  });

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' },
    },
  });
}

function trendArrow(trend?: ReportKPI['trend']): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  if (trend === 'flat') return '→';
  return '';
}

function makeDataTable(d: D, table: ReportTable) {
  const {
    Table,
    TableRow,
    TableCell,
    Paragraph,
    TextRun,
    WidthType,
    BorderStyle,
    ShadingType,
  } = d;

  const out: Array<ReturnType<typeof makeH3> | InstanceType<typeof Table> | InstanceType<typeof Paragraph>> = [];
  out.push(makeH3(d, table.title));

  if (!table?.rows?.length) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Nessun dato nel periodo selezionato.',
            italics: true,
            color: SLATE_500,
            size: 20,
          }),
        ],
      }),
    );
    return out;
  }

  const border = {
    top: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
    left: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
    right: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: table.columns.map(
      (col) =>
        new TableCell({
          borders: border,
          shading: { type: ShadingType.SOLID, color: SLATE_100, fill: SLATE_100 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: String(col),
                  bold: true,
                  size: 18,
                  color: SLATE_700,
                }),
              ],
            }),
          ],
        }),
    ),
  });

  const bodyRows = table.rows.map((row, idx) => {
    const zebra = idx % 2 === 1;
    return new TableRow({
      children: row.map(
        (cell) =>
          new TableCell({
            borders: border,
            shading: zebra
              ? { type: ShadingType.SOLID, color: 'F8FAFC', fill: 'F8FAFC' }
              : undefined,
            children: [
              new Paragraph({
                children: [new TextRun({ text: String(cell), size: 18 })],
              }),
            ],
          }),
      ),
    });
  });

  out.push(
    new Table({
      rows: [headerRow, ...bodyRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
  );

  if (table.footnote) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({
            text: table.footnote,
            italics: true,
            size: 16,
            color: SLATE_500,
          }),
        ],
        spacing: { before: 60, after: 120 },
      }),
    );
  }

  return out;
}

function makeChartAsTable(d: D, chart: ReportChart) {
  // Render chart as a caption + a compact data table (docx doesn't support SVG natively).
  const {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    ShadingType,
  } = d;

  const out: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [];
  out.push(makeH3(d, chart.title));

  if (!chart.datasets?.length || !chart.labels?.length) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Dati insufficienti per il grafico.',
            italics: true,
            color: SLATE_500,
            size: 18,
          }),
        ],
      }),
    );
    return out;
  }

  out.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Tipo grafico: ${chart.type} · ${chart.labels.length} punti · ${chart.datasets.length} serie`,
          italics: true,
          size: 16,
          color: SLATE_500,
        }),
      ],
      spacing: { after: 80 },
    }),
  );

  const border = {
    top: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
    left: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
    right: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
  };

  // Header: [Periodo, serie1, serie2, ...]
  const headerCells = [
    new TableCell({
      borders: border,
      shading: { type: ShadingType.SOLID, color: SLATE_100, fill: SLATE_100 },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: chart.xAxisLabel ?? 'Periodo', bold: true, size: 16 }),
          ],
        }),
      ],
    }),
    ...chart.datasets.map(
      (ds) =>
        new TableCell({
          borders: border,
          shading: { type: ShadingType.SOLID, color: SLATE_100, fill: SLATE_100 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: ds.label, bold: true, size: 16 })],
            }),
          ],
        }),
    ),
  ];

  const bodyRows = chart.labels.map((label, i) => {
    const cells = [
      new TableCell({
        borders: border,
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, size: 16 })],
          }),
        ],
      }),
      ...chart.datasets.map(
        (ds) =>
          new TableCell({
            borders: border,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: ds.data[i] !== undefined ? String(ds.data[i]) : '-',
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
      ),
    ];
    return new TableRow({ children: cells });
  });

  out.push(
    new Table({
      rows: [new TableRow({ tableHeader: true, children: headerCells }), ...bodyRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
  );

  return out;
}

function makeAcwrDistribution(
  d: D,
  title: string,
  buckets: { low: number; optimal: number; high: number; danger: number },
) {
  const {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    ShadingType,
  } = d;

  const total = buckets.low + buckets.optimal + buckets.high + buckets.danger || 1;
  const rows: Array<[string, number, string]> = [
    ['Basso (<0.8)', buckets.low, '60A5FA'],
    ['Ottimale (0.8-1.3)', buckets.optimal, GREEN],
    ['Alto (1.3-1.5)', buckets.high, AMBER],
    ['Rischio (>1.5)', buckets.danger, RED],
  ];

  const border = {
    top: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
    left: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
    right: { style: BorderStyle.SINGLE, size: 4, color: SLATE_200 },
  };

  const tableRows = rows.map(
    ([label, count, color]) =>
      new TableRow({
        children: [
          new TableCell({
            borders: border,
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color, fill: color },
            children: [new Paragraph({ text: '' })],
          }),
          new TableCell({
            borders: border,
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: label, size: 18 })],
              }),
            ],
          }),
          new TableCell({
            borders: border,
            width: { size: 20, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: String(count), bold: true, size: 18 }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: border,
            width: { size: 20, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${((count / total) * 100).toFixed(1)}%`,
                    size: 18,
                    color: SLATE_500,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
  );

  return [
    makeH3(d, title),
    new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
  ];
}

// ─── Audience-specific body builders ─────────────────────────

function bodyStaff(d: D, r: StaffReportData): unknown[] {
  const { Paragraph, TextRun } = d;
  return [
    ...makeHeader(d, r.metadata, 'Staff Tecnico'),
    makeSummaryBox(d, r.summary),
    makeH2(d, 'KPI Principali'),
    makeKpiTable(d, r.kpis),
    makeH2(d, 'Distribuzione Carico (ACWR)'),
    ...makeAcwrDistribution(
      d,
      `Atleti per fascia ACWR al ${formatDate(r.metadata.periodTo)}`,
      r.acwrDistribution,
    ),
    makeH2(d, 'Sessioni del Periodo'),
    new Paragraph({
      children: [
        new TextRun({ text: 'Pianificate: ', size: 20 }),
        new TextRun({ text: String(r.sessionsCompleted.planned), bold: true, size: 20 }),
        new TextRun({ text: ' · Completate: ', size: 20 }),
        new TextRun({ text: String(r.sessionsCompleted.completed), bold: true, size: 20 }),
        new TextRun({ text: ' · Cancellate: ', size: 20 }),
        new TextRun({ text: String(r.sessionsCompleted.cancelled), bold: true, size: 20 }),
        new TextRun({ text: ' · Tasso completamento: ', size: 20 }),
        new TextRun({
          text: `${r.sessionsCompleted.completionRate.toFixed(1)}%`,
          bold: true,
          size: 20,
          color: TEAL,
        }),
      ],
      spacing: { after: 240 },
    }),
    makeH2(d, 'Andamento Wellness Team'),
    ...makeChartAsTable(d, r.wellnessTrend),
    makeH2(d, 'Carico di Allenamento (sRPE)'),
    ...makeChartAsTable(d, r.loadTrend),
    makeH2(d, 'Alert Attivi'),
    ...makeDataTable(d, r.activeAlerts),
  ];
}

function bodyMedical(d: D, r: MedicalReportData): unknown[] {
  const sections: unknown[] = [
    ...makeHeader(d, r.metadata, 'Staff Medico'),
    makeSummaryBox(d, r.summary),
    makeH2(d, 'KPI Clinici'),
    makeKpiTable(d, r.kpis),
    makeH2(d, 'Atleti Infortunati'),
    ...makeDataTable(d, r.injuredAthletes),
  ];
  if (r.rtpProgress) {
    sections.push(makeH2(d, 'Progressione RTP'), ...makeChartAsTable(d, r.rtpProgress));
  }
  sections.push(makeH2(d, 'Metriche di Recupero'), ...makeDataTable(d, r.recoveryMetrics));
  if (r.wellnessFlags.rows.length > 0) {
    sections.push(makeH2(d, 'Flag Wellness'), ...makeDataTable(d, r.wellnessFlags));
  }
  if (r.injuryHistoryByType) {
    sections.push(makeH2(d, 'Infortuni per Tipo'), ...makeChartAsTable(d, r.injuryHistoryByType));
  }
  if (r.injuryHistoryByZone) {
    sections.push(makeH2(d, 'Infortuni per Zona Corporea'), ...makeChartAsTable(d, r.injuryHistoryByZone));
  }
  if (r.injuredWellnessTrend) {
    sections.push(makeH2(d, 'Wellness Atleti Infortunati'), ...makeChartAsTable(d, r.injuredWellnessTrend));
  }
  if (r.loadVsInjuries) {
    sections.push(makeH2(d, 'Carico vs Infortuni'), ...makeChartAsTable(d, r.loadVsInjuries));
  }
  return sections;
}

function bodyTrainer(d: D, r: TrainerReportData): unknown[] {
  return [
    ...makeHeader(d, r.metadata, 'Preparazione Atletica'),
    makeSummaryBox(d, r.summary),
    makeH2(d, 'KPI Tecnici'),
    makeKpiTable(d, r.kpis),
    makeH2(d, 'Aderenza per Atleta'),
    ...makeDataTable(d, r.adherenceByAthlete),
    makeH2(d, 'Trend di Performance'),
    ...makeChartAsTable(d, r.performanceTrends),
    makeH2(d, 'Pianificato vs Reale'),
    ...makeChartAsTable(d, r.plannedVsActual),
    makeH2(d, 'Adattamenti del Piano'),
    ...makeDataTable(d, r.adaptations),
    makeH2(d, 'Top Mover'),
    ...makeDataTable(d, r.topMovers),
  ];
}

// ─── Public API ──────────────────────────────────────────────

export async function renderReportDocx(report: ReportData): Promise<Buffer> {
  const d = await getDocx();
  const { Document, Packer, Footer, Paragraph, TextRun, AlignmentType, PageNumber } = d;

  let children: unknown[];
  if (report.audience === 'STAFF') children = bodyStaff(d, report);
  else if (report.audience === 'MEDICAL') children = bodyMedical(d, report);
  else children = bodyTrainer(d, report);

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `TrainMind · ${report.metadata.organizationName} · Report ${report.audience} · pagina `,
            size: 14,
            color: SLATE_500,
          }),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, color: SLATE_500 }),
          new TextRun({ text: ' di ', size: 14, color: SLATE_500 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: SLATE_500 }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: 'TrainMind',
    title: `Report ${report.audience} - ${report.metadata.organizationName}`,
    description: `Report periodico ${report.metadata.periodFrom} / ${report.metadata.periodTo}`,
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { size: 44, bold: true, color: TEAL },
          paragraph: { spacing: { before: 0, after: 120 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: { size: 28, bold: true, color: '0F172A' },
          paragraph: { spacing: { before: 320, after: 140 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          run: { size: 22, bold: true, color: SLATE_700 },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, right: 900, bottom: 1200, left: 900 },
          },
        },
        // @ts-expect-error docx accepts Paragraphs and Tables interchangeably here
        children,
        footers: { default: footer },
      },
    ],
  });

  const uint8 = await Packer.toBuffer(doc);
  return Buffer.from(uint8);
}
