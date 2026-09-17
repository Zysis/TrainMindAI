/**
 * PDF Report Renderer - Sprint 4.1.3
 *
 * Renders a ReportData object to a PDF buffer using Puppeteer.
 *
 * Strategy:
 *   1. Build a self-contained HTML document with inline CSS (no Tailwind runtime)
 *   2. Charts are rendered as pure SVG (server-side, no client JS required)
 *   3. Puppeteer launches headless Chrome, sets content, prints to PDF
 *   4. Browser instance is reused across calls (singleton) to avoid cold starts
 *
 * Audience-specific templates are dispatched from `renderReportPdf`.
 */

import type {
  ReportData,
  StaffReportData,
  MedicalReportData,
  ManagementReportData,
  ReportKPI,
  ReportTable,
  ReportChart,
  ReportMetadata,
} from '@trainmind/types';

// Puppeteer is imported lazily. Types are loose (`any`) because the dynamic import
// creates friction with the real puppeteer typings once the package is installed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getBrowser(): Promise<any> {
  // Il browser viene riusato tra un report e l'altro, ma la promise NON va
  // memorizzata quando fallisce o quando Chrome muore: altrimenti ogni PDF
  // successivo eredita l'errore finché non si riavvia l'API.
  const cached = browserPromise;
  if (cached) {
    try {
      const browser = await cached;
      const alive =
        typeof browser?.connected === 'boolean'
          ? browser.connected
          : typeof browser?.isConnected === 'function'
            ? browser.isConnected()
            : Boolean(browser);
      if (alive) return browser;
    } catch {
      // il tentativo precedente è fallito: si riprova da zero
    }
    if (browserPromise === cached) browserPromise = null;
  }

  const attempt = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puppeteer: any = await import('puppeteer').catch((err) => {
      throw new Error(
        `Puppeteer non installato. Esegui: pnpm add puppeteer --filter @trainmind/api. Dettagli: ${String(err)}`,
      );
    });
    try {
      return await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    } catch (err) {
      throw new Error(
        'Chrome per Puppeteer non disponibile: il pacchetto è installato ma il browser non è stato scaricato. ' +
          'Esegui `npx puppeteer browsers install chrome` dalla cartella apps/api. ' +
          `Dettagli: ${String(err)}`,
      );
    }
  })();

  browserPromise = attempt;
  attempt.catch(() => {
    if (browserPromise === attempt) browserPromise = null;
  });
  return attempt;
}

export async function closePdfRenderer(): Promise<void> {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      if (browser) await browser.close();
    } catch {
      // ignore
    }
    browserPromise = null;
  }
}

// ─── HTML helpers ───────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── CSS ─────────────────────────────────────────────────────

const CSS = `
  @page { size: A4; margin: 18mm 14mm 22mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    font-size: 11px;
    line-height: 1.5;
    margin: 0;
  }
  h1 { font-size: 22px; margin: 0 0 4px 0; color: #0f766e; letter-spacing: -0.3px; }
  h2 { font-size: 14px; margin: 22px 0 8px 0; color: #0f172a; border-bottom: 2px solid #0f766e; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 14px 0 6px 0; color: #334155; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 12px;
    border-bottom: 3px solid #0f766e;
    margin-bottom: 16px;
  }
  .header-meta { text-align: right; font-size: 10px; color: #64748b; }
  .badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    background: #ccfbf1;
    color: #0f766e;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .summary {
    background: #f0fdfa;
    border-left: 4px solid #0f766e;
    padding: 12px 16px;
    margin: 12px 0 18px 0;
    border-radius: 4px;
    font-size: 11px;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 10px;
    margin: 10px 0 18px 0;
  }
  .kpi-card {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 12px;
    background: #ffffff;
  }
  .kpi-card .label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .kpi-card .value { font-size: 20px; font-weight: 700; color: #0f172a; }
  .kpi-card .delta { font-size: 10px; margin-top: 2px; }
  .kpi-card.info    { border-top: 3px solid #0ea5e9; }
  .kpi-card.success { border-top: 3px solid #10b981; }
  .kpi-card.warning { border-top: 3px solid #f59e0b; }
  .kpi-card.danger  { border-top: 3px solid #ef4444; }
  .delta.up   { color: #10b981; }
  .delta.down { color: #ef4444; }
  .delta.flat { color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px 0; font-size: 10px; }
  thead th { background: #f1f5f9; color: #334155; text-align: left; padding: 6px 8px; border-bottom: 2px solid #cbd5e1; font-weight: 600; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .footnote { font-size: 9px; color: #64748b; margin-top: 4px; font-style: italic; }
  .chart-wrap { margin: 8px 0 16px 0; break-inside: avoid; }
  h2, h3 { break-after: avoid; }
  .chart-wrap .chart-title { font-size: 11px; font-weight: 600; color: #334155; margin-bottom: 4px; }
  .legend { display: flex; gap: 12px; font-size: 9px; color: #475569; margin-top: 4px; }
  .legend .dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
  .distribution-bar { display: flex; width: 100%; height: 22px; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0; margin: 4px 0 12px 0; }
  .distribution-bar .seg { display: flex; align-items: center; justify-content: center; font-size: 9px; color: #fff; font-weight: 600; }
  .distribution-legend { display: flex; gap: 12px; font-size: 9px; color: #475569; margin-bottom: 10px; }
  .narrative { font-size: 13px; line-height: 1.7; color: #1e293b; margin: 14px 0 10px 0; }
  .keypoints { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px 10px 30px; margin: 0 0 16px 0; font-size: 12px; }
  .keypoints li { margin: 3px 0; }
  .keypoints-title { font-size: 10px; font-weight: 700; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px -16px; list-style: none; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 8px 0 14px 0; }
  .tile { border-radius: 8px; padding: 12px; color: #fff; }
  .tile .n { font-size: 28px; font-weight: 800; line-height: 1; }
  .tile .t { font-size: 11px; margin-top: 4px; opacity: 0.95; }
  .tile.ok { background: #0d9488; } .tile.mid { background: #f59e0b; } .tile.ko { background: #ef4444; }
  .explain { font-size: 10px; color: #475569; margin: -4px 0 12px 0; }
  .empty-note { font-size: 11px; color: #0f766e; font-weight: 600; margin: 6px 0 14px 0; }
  .avoid-break { break-inside: avoid; }
  .footer-watermark {
    position: fixed;
    bottom: 6mm;
    left: 14mm;
    right: 14mm;
    font-size: 8px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #e2e8f0;
    padding-top: 4px;
  }
`;

// ─── Renderers ───────────────────────────────────────────────

function renderHeader(metadata: ReportMetadata, audienceLabel: string): string {
  const teamLine = metadata.teamName
    ? `<div style="font-size: 12px; color: #0d9488; font-weight: 600; margin-top: 2px;">Squadra: ${esc(metadata.teamName)}</div>`
    : '';
  const athleteLine = metadata.athleteName
    ? `<div style="font-size: 12px; color: #0f172a; font-weight: 600; margin-top: 2px;">Atleta: ${esc(metadata.athleteName)}</div>`
    : '';
  return `
    <div class="header">
      <div>
        <div class="badge">${esc(audienceLabel)}</div>
        <h1>${esc(metadata.organizationName)}</h1>
        ${teamLine}
        ${athleteLine}
        <div style="font-size: 11px; color: #64748b;">Report periodico · ${formatDate(metadata.periodFrom)} — ${formatDate(metadata.periodTo)}</div>
      </div>
      <div class="header-meta">
        <div><strong>TrainMind</strong></div>
        <div>Generato il ${formatDate(metadata.generatedAt)}</div>
        <div>Da ${esc(metadata.generatedBy)}</div>
      </div>
    </div>
  `;
}

function renderSummary(summary: string): string {
  return `<div class="summary">${esc(summary)}</div>`;
}

function severityClass(s: ReportKPI['severity']): string {
  return s || 'info';
}

function trendArrow(trend?: ReportKPI['trend']): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  if (trend === 'flat') return '→';
  return '';
}

function renderKpis(kpis: ReportKPI[]): string {
  if (!kpis.length) return '';
  const cards = kpis
    .map(
      (k) => `
    <div class="kpi-card ${severityClass(k.severity)}">
      <div class="label">${esc(k.label)}</div>
      <div class="value">${esc(k.value)}</div>
      ${k.delta ? `<div class="delta ${k.trend ?? 'flat'}">${trendArrow(k.trend)} ${esc(k.delta)}</div>` : ''}
    </div>
  `,
    )
    .join('');
  return `<div class="kpi-grid">${cards}</div>`;
}

function renderTable(table: ReportTable): string {
  if (!table || !table.rows?.length) {
    return `
      <h3>${esc(table?.title ?? '')}</h3>
      <p style="font-size: 10px; color: #64748b; font-style: italic;">Nessun dato nel periodo selezionato.</p>
    `;
  }
  const ths = table.columns.map((c) => `<th>${esc(c)}</th>`).join('');
  const trs = table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `
    <h3>${esc(table.title)}</h3>
    <table>
      <thead><tr>${ths}</tr></thead>
      <tbody>${trs}</tbody>
    </table>
    ${table.footnote ? `<div class="footnote">${esc(table.footnote)}</div>` : ''}
  `;
}

// ─── SVG chart rendering ────────────────────────────────────

const CHART_W = 520;
const CHART_H = 180;
const CHART_PAD = { top: 16, right: 16, bottom: 28, left: 36 };

const DEFAULT_COLORS = ['#0f766e', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'];

function renderChart(chart: ReportChart): string {
  if (!chart.datasets?.length || !chart.labels?.length) {
    return `
      <div class="chart-wrap">
        <div class="chart-title">${esc(chart.title)}</div>
        <p style="font-size: 10px; color: #64748b; font-style: italic;">Dati insufficienti per il grafico.</p>
      </div>
    `;
  }

  const innerW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

  const allValues = chart.datasets.flatMap((d) => d.data);
  const maxVal = Math.max(1, chart.yMax ?? 0, ...allValues);
  const minVal = Math.min(0, ...allValues);
  const range = maxVal - minVal || 1;

  const n = chart.labels.length;
  // Le barre stanno al centro di una "fascia" per etichetta: con i punti agli
  // estremi (come per le linee) la prima e l'ultima uscivano dal grafico e
  // coprivano i numeri dell'asse.
  const isBar = chart.type === 'bar';
  const xStep = isBar ? innerW / n : n > 1 ? innerW / (n - 1) : innerW;

  const y = (v: number) => CHART_PAD.top + innerH - ((v - minVal) / range) * innerH;
  const x = (i: number) =>
    CHART_PAD.left + (isBar ? xStep * (i + 0.5) : n > 1 ? i * xStep : innerW / 2);

  // Gridlines (4 horizontal)
  const gridLines: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const yPos = CHART_PAD.top + (innerH / 4) * i;
    const val = maxVal - (range / 4) * i;
    gridLines.push(
      `<line x1="${CHART_PAD.left}" y1="${yPos}" x2="${CHART_PAD.left + innerW}" y2="${yPos}" stroke="#e2e8f0" stroke-width="1"/>`,
    );
    gridLines.push(
      `<text x="${CHART_PAD.left - 4}" y="${yPos + 3}" text-anchor="end" font-size="8" fill="#94a3b8">${val.toFixed(0)}</text>`,
    );
  }

  // X-axis labels (sparse if many)
  const labelEvery = Math.max(1, Math.ceil(n / 8));
  const xLabels: string[] = [];
  chart.labels.forEach((lbl, i) => {
    if (i % labelEvery !== 0 && i !== n - 1) return;
    xLabels.push(
      `<text x="${x(i)}" y="${CHART_PAD.top + innerH + 12}" text-anchor="middle" font-size="8" fill="#94a3b8">${esc(lbl)}</text>`,
    );
  });

  // Datasets
  const seriesSvg: string[] = [];
  const legendItems: string[] = [];
  chart.datasets.forEach((ds, idx) => {
    const color = ds.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
    legendItems.push(
      `<span><span class="dot" style="background:${color}"></span>${esc(ds.label)}</span>`,
    );

    if (chart.type === 'bar') {
      const barW = (xStep * 0.6) / chart.datasets.length;
      ds.data.forEach((v, i) => {
        const bx = x(i) - (xStep * 0.3) + idx * barW;
        const by = y(v);
        const bh = Math.max(0, y(minVal) - by);
        seriesSvg.push(
          `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${color}" opacity="0.85" rx="1"/>`,
        );
      });
    } else {
      // line / area
      const pts = ds.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      if (chart.type === 'area') {
        const areaPts = `${x(0)},${y(minVal)} ${pts} ${x(n - 1)},${y(minVal)}`;
        seriesSvg.push(
          `<polygon points="${areaPts}" fill="${color}" fill-opacity="0.15"/>`,
        );
      }
      seriesSvg.push(
        `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
      );
      ds.data.forEach((v, i) => {
        seriesSvg.push(
          `<circle cx="${x(i)}" cy="${y(v)}" r="2.5" fill="${color}"/>`,
        );
      });
    }
  });

  return `
    <div class="chart-wrap">
      <div class="chart-title">${esc(chart.title)}</div>
      <svg width="100%" viewBox="0 0 ${CHART_W} ${CHART_H}" xmlns="http://www.w3.org/2000/svg">
        ${gridLines.join('\n')}
        ${seriesSvg.join('\n')}
        ${xLabels.join('\n')}
      </svg>
      <div class="legend">${legendItems.join('')}</div>
    </div>
  `;
}

function renderDistributionBar(
  title: string,
  buckets: { low: number; optimal: number; high: number; danger: number },
): string {
  return renderSegmentBar(title, [
    ['#60a5fa', buckets.low, 'Basso'],
    ['#10b981', buckets.optimal, 'Ottimale'],
    ['#f59e0b', buckets.high, 'Alto'],
    ['#ef4444', buckets.danger, 'Rischio'],
  ]);
}

function renderSegmentBar(title: string, input: Array<[string, number, string]>): string {
  const total = input.reduce((s, [, n]) => s + n, 0) || 1;
  const pct = (n: number) => (n / total) * 100;
  const segs: Array<[string, number, string]> = input.map(([color, n, label]) => [color, pct(n), `${label} (${n})`]);
  const bar = segs
    .filter(([, p]) => p > 0)
    .map(
      ([color, p]) =>
        `<div class="seg" style="width:${p}%;background:${color}">${p > 10 ? Math.round(p) + '%' : ''}</div>`,
    )
    .join('');
  const legend = segs
    .map(
      ([color, , label]) =>
        `<span><span class="dot" style="background:${color}"></span>${esc(label)}</span>`,
    )
    .join('');
  return `
    <h3>${esc(title)}</h3>
    <div class="distribution-bar">${bar}</div>
    <div class="distribution-legend">${legend}</div>
  `;
}

// ─── Audience templates ──────────────────────────────────────

function renderStaff(r: StaffReportData): string {
  return `
    ${renderHeader(r.metadata, 'Staff Tecnico')}
    ${renderSummary(r.summary)}
    <h2>KPI Principali</h2>
    ${renderKpis(r.kpis)}

    <h2>Distribuzione Carico (ACWR)</h2>
    ${renderDistributionBar('Atleti per fascia ACWR al ' + formatDate(r.metadata.periodTo), r.acwrDistribution)}

    <h2>Sessioni del Periodo</h2>
    <div style="font-size: 11px; color: #334155; margin-bottom: 8px;">
      Pianificate: <strong>${r.sessionsCompleted.planned}</strong> ·
      Completate: <strong>${r.sessionsCompleted.completed}</strong> ·
      Cancellate: <strong>${r.sessionsCompleted.cancelled}</strong> ·
      Tasso completamento: <strong>${(r.sessionsCompleted.completionRate * 100).toFixed(0)}%</strong>
    </div>

    <h2>Andamento Wellness Team</h2>
    ${renderChart(r.wellnessTrend)}

    <h2>Carico di Allenamento (sRPE)</h2>
    ${renderChart(r.loadTrend)}

    <h2>Alert Attivi</h2>
    ${renderTable(r.activeAlerts)}

    ${r.adherenceByAthlete ? `<h2>Aderenza al Piano per Atleta</h2>${renderTable(r.adherenceByAthlete)}` : ''}
    ${r.performanceTrends ? `<h2>Volume Settimanale</h2>${renderChart(r.performanceTrends)}` : ''}
    ${r.plannedVsActual ? `<h2>Pianificato vs Reale</h2>${renderChart(r.plannedVsActual)}` : ''}
    ${r.adaptations ? `<h2>Adattamenti del Piano</h2>${renderTable(r.adaptations)}` : ''}
    ${r.topMovers && r.topMovers.rows.length > 0 ? `<h2>Atleti con Maggiori Variazioni</h2>${renderTable(r.topMovers)}` : ''}
  `;
}

function renderMedical(r: MedicalReportData): string {
  return `
    ${renderHeader(r.metadata, 'Staff Medico')}
    ${renderSummary(r.summary)}
    <h2>KPI Clinici</h2>
    ${renderKpis(r.kpis)}

    <h2>Atleti Infortunati</h2>
    ${renderTable(r.injuredAthletes)}

    ${r.rtpProgress ? `<h2>Progressione RTP</h2>${renderChart(r.rtpProgress)}` : ''}

    <h2>Metriche di Recupero</h2>
    ${renderTable(r.recoveryMetrics)}

    ${r.wellnessFlags.rows.length > 0 ? `<h2>Flag Wellness</h2>${renderTable(r.wellnessFlags)}` : ''}

    ${r.injuryHistoryByType ? `<h2>Infortuni per Tipo</h2>${renderChart(r.injuryHistoryByType)}` : ''}
    ${r.injuryHistoryByZone ? `<h2>Infortuni per Zona Corporea</h2>${renderChart(r.injuryHistoryByZone)}` : ''}
    ${r.injuredWellnessTrend ? `<h2>Wellness Atleti Infortunati</h2>${renderChart(r.injuredWellnessTrend)}` : ''}
    ${r.loadVsInjuries ? `<h2>Carico vs Infortuni</h2>${renderChart(r.loadVsInjuries)}` : ''}
  `;
}

function renderManagement(r: ManagementReportData): string {
  const a = r.availability;
  const h = r.teamHealth;
  const highlights = r.highlights.length
    ? `<ul class="keypoints"><li class="keypoints-title">Punti chiave</li>${r.highlights.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    : '';
  const table = r.unavailableAthletes.rows.length
    ? renderTable(r.unavailableAthletes)
    : `<p class="empty-note">Tutta la rosa è a disposizione.</p>`;
  const assessed = h.loadRisk.green + h.loadRisk.yellow + h.loadRisk.red + h.loadRisk.noData;
  return `
    ${renderHeader(r.metadata, 'Dirigenza')}
    <div class="narrative">${esc(r.summary)}</div>
    ${highlights}

    <h2>La squadra in numeri</h2>
    ${renderKpis(r.kpis)}

    <div class="avoid-break">
      <h2>Disponibilità della rosa</h2>
      <div class="tiles">
        <div class="tile ok"><div class="n">${a.available}</div><div class="t">a disposizione</div></div>
        <div class="tile mid"><div class="n">${a.limited}</div><div class="t">in rientro graduale</div></div>
        <div class="tile ko"><div class="n">${a.unavailable}</div><div class="t">fermi per infortunio</div></div>
      </div>
      <p class="explain">Situazione al ${formatDate(a.asOf)} su ${a.total} atleti.</p>
      ${renderChart(r.availabilityTrend)}
    </div>
    ${table}

    <div class="avoid-break">
      <h2>Salute della squadra</h2>
      ${h.wellnessTrend.labels.length ? renderChart(h.wellnessTrend) : '<p class="explain">Nessun questionario di benessere compilato nel periodo.</p>'}
      <p class="explain">Il benessere è la media dei questionari giornalieri dei giocatori (sonno, fatica, dolori, stress, umore): sopra 70 è buono, sotto 55 va approfondito.</p>
    </div>
    ${assessed > 0 ? `
    <div class="avoid-break">
      ${renderSegmentBar('Carico di lavoro degli atleti a disposizione', [
        ['#10b981', h.loadRisk.green, 'In equilibrio'],
        ['#f59e0b', h.loadRisk.yellow, 'Da monitorare'],
        ['#ef4444', h.loadRisk.red, 'Zona di rischio'],
        ['#cbd5e1', h.loadRisk.noData, 'Dati insufficienti'],
      ])}
      <p class="explain">Confronta il lavoro dell'ultima settimana con quello delle tre precedenti: un aumento o un calo troppo bruschi espongono di più agli infortuni.</p>
    </div>` : ''}
  `;
}

function buildHtml(report: ReportData): string {
  let body: string;
  if (report.audience === 'STAFF') body = renderStaff(report);
  else if (report.audience === 'MEDICAL') body = renderMedical(report);
  else body = renderManagement(report);

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>TrainMind Report</title>
  <style>${CSS}</style>
</head>
<body>
  ${body}
</body>
</html>`;
}

export const AUDIENCE_LABELS: Record<string, string> = {
  STAFF: 'Staff tecnico',
  MEDICAL: 'Staff medico',
  MANAGEMENT: 'Dirigenza',
};

// ─── Public API ──────────────────────────────────────────────

/**
 * Un grafico come PNG, per il Word (che non legge SVG). Stesso disegno del
 * PDF, fotografato da Chrome. Restituisce null se Chrome non c'e': chi chiama
 * ripiega sulla tabella dei valori.
 */
export async function renderChartPng(
  chart: ReportChart,
): Promise<{ data: Buffer; width: number; height: number } | null> {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 720, height: 400, deviceScaleFactor: 2 });
      await page.setContent(
        `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${CSS} body{padding:8px;background:#fff}</style></head><body>${renderChart(chart)}</body></html>`,
        { waitUntil: 'networkidle0' },
      );
      const el = await page.$('.chart-wrap');
      if (!el) return null;
      const box = await el.boundingBox();
      const shot = await el.screenshot({ type: 'png' });
      return { data: Buffer.from(shot), width: Math.round(box?.width ?? 700), height: Math.round(box?.height ?? 300) };
    } finally {
      await page.close().catch(() => {});
    }
  } catch {
    return null;
  }
}

/**
 * Render a ReportData object to a PDF buffer.
 * @throws Error if Puppeteer is not installed or the render fails.
 */
export async function renderReportPdf(report: ReportData): Promise<Buffer> {
  const html = buildHtml(report);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    // Il piè di pagina lo disegna Chrome nel margine: il vecchio div
    // `position: fixed` finiva sopra i grafici in fondo alla pagina.
    const footerStyle = 'width:100%;font-size:7px;color:#94a3b8;padding:0 14mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif;';
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '14mm', bottom: '22mm', left: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="${footerStyle}"><span>TrainMind · Report ${esc(AUDIENCE_LABELS[report.audience] ?? report.audience)} · ${esc(report.metadata.organizationName)}</span><span>${formatDate(report.metadata.generatedAt)} · pagina <span class="pageNumber"></span> di <span class="totalPages"></span></span></div>`,
    });
    return Buffer.from(pdfBytes);
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Exposed for tests / debugging: returns the raw HTML without launching Chrome.
 */
export function buildReportHtml(report: ReportData): string {
  return buildHtml(report);
}

/**
 * Stampa un HTML gia' pronto. Serve ai report che hanno un impaginato loro
 * (il giornaliero) e che non passano da `buildHtml`: riusano lo stesso Chrome,
 * la stessa gestione della connessione caduta e la stessa chiusura pulita,
 * invece di aprirne un secondo.
 */
export async function renderHtmlToPdf(
  html: string,
  options?: { margin?: { top: string; right: string; bottom: string; left: string }; landscape?: boolean },
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      landscape: options?.landscape ?? false,
      margin: options?.margin ?? { top: '12mm', right: '10mm', bottom: '14mm', left: '10mm' },
      displayHeaderFooter: false,
    });
    return Buffer.from(pdfBytes);
  } finally {
    await page.close().catch(() => {});
  }
}
