/**
 * Report giornaliero — resa PDF.
 *
 * Impaginato dedicato, non riusa `buildHtml` del report engine: quello e'
 * costruito su KPI/tabelle/grafici generici, mentre qui la pagina E' una
 * tabella con celle colorate e foto. Riusa pero' lo stesso Chrome, tramite
 * `renderHtmlToPdf`.
 *
 * Le foto arrivano come data URL dal database (colonna `photoUrl`): nessuna
 * richiesta di rete parte dalla pagina, quindi `networkidle0` non aspetta
 * risorse esterne e il PDF non dipende da un CDN raggiungibile.
 */

import type { DailyReportData, DailyDensitySection } from '@trainmind/types';
import { renderHtmlToPdf } from './report-renderer-pdf.js';

// Stessi colori della legenda sul foglio cartaceo: 0 rosso → 5 verde.
const STATUS_COLORS: Record<number, { bg: string; fg: string }> = {
  0: { bg: '#f2706e', fg: '#4a1010' },
  1: { bg: '#f5945c', fg: '#4a2410' },
  2: { bg: '#f7c45c', fg: '#4a3410' },
  3: { bg: '#dfe06a', fg: '#3f4210' },
  4: { bg: '#93cf85', fg: '#16401a' },
  5: { bg: '#48bf8a', fg: '#0b3d28' },
};

const BAND_LABEL_KEY: Record<DailyDensitySection['densityBand'], string> = {
  LOW: 'bandLow', MEDIUM: 'bandMedium', HIGH: 'bandHigh', VERY_HIGH: 'bandVeryHigh',
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Solo data URL di immagini: un URL esterno in `src` farebbe uscire una richiesta. */
function safeImg(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(url) ? url : null;
}

function fmtMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}min ${s}s`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function renderLegend(r: DailyReportData): string {
  const rows = [5, 4, 3, 2, 1, 0].map((n) => {
    const c = STATUS_COLORS[n];
    return `<tr>
      <td class="lg-n" style="background:${c.bg};color:${c.fg}">${n}</td>
      <td class="lg-l">${esc(r.statusLabels[String(n)] ?? '')}</td>
    </tr>`;
  }).join('');
  return `<table class="legend">${rows}</table>`;
}

function renderActivities(r: DailyReportData): string {
  if (r.activities.length === 0) {
    return `<table class="acts"><tr><th colspan="2">${esc(r.labels.activities)}</th></tr>
      <tr><td class="empty" colspan="2">—</td></tr></table>`;
  }
  const rows = r.activities.map((a) => `<tr>
      <td class="a-l">${esc(a.label)}</td>
      <td class="a-m">${a.minutes}'</td>
    </tr>`).join('');
  return `<table class="acts"><tr><th colspan="2">${esc(r.labels.activities)}</th></tr>${rows}</table>`;
}

/** Le nove colonne cliniche, nell'ordine del foglio cartaceo. */
const CLINICAL_KEYS = [
  'nextTraining', 'injuryType', 'bodyPart', 'side',
  'clinicalStatus', 'taping', 'treatment', 'trainingType', 'forecast',
] as const;

/** Etichetta di un codice; stringa vuota se il campo non e' compilato. */
function vocab(r: DailyReportData, field: string, code: string | null | undefined): string {
  if (!code) return '';
  return r.vocabLabels?.[field]?.[code] ?? code;
}

/** true se almeno una riga ha qualcosa di clinico: se no, niente tabella. */
function hasClinical(r: DailyReportData): boolean {
  return r.entries.some((e) => CLINICAL_KEYS.some((k) => e.clinical?.[k]));
}

const NEXT_TRAINING_BG: Record<string, string> = {
  available: '#c9efd8', partial: '#fdf0c2', unavailable: '#fbd3d1',
};

function renderClinical(r: DailyReportData): string {
  // Tabella larga e quasi sempre vuota: si stampa solo se qualcuno l'ha
  // compilata, e su una pagina propria in orizzontale non ci sta comunque —
  // meglio poche colonne strette che una pagina ruotata.
  if (!hasClinical(r)) return '';
  const head = ['player', 'nextTraining', 'injury', 'bodyPart', 'side', 'clinicalStatus', 'taping', 'treatment', 'trainingType', 'forecast']
    .map((k) => `<th>${esc(r.labels[k] ?? k)}</th>`).join('');
  const rows = r.entries
    .filter((e) => CLINICAL_KEYS.some((k) => e.clinical?.[k]))
    .map((e) => {
      const nt = e.clinical?.nextTraining;
      const cells = CLINICAL_KEYS.map((k) => {
        const style = k === 'nextTraining' && nt ? ` style="background:${NEXT_TRAINING_BG[nt] ?? ''}"` : '';
        return `<td${style}>${esc(vocab(r, k, e.clinical?.[k]))}</td>`;
      }).join('');
      return `<tr><td class="cl-name">${esc(e.athleteName)}</td>${cells}</tr>`;
    }).join('');
  return `<section class="clin">
    <h2>${esc(r.labels.clinicalSection)}</h2>
    <table class="dt cl"><tr>${head}</tr>${rows}</table>
  </section>`;
}

function renderPlayers(r: DailyReportData): string {
  const rows = r.entries.map((e) => {
    const c = STATUS_COLORS[e.status] ?? STATUS_COLORS[5];
    const img = safeImg(e.photoUrl);
    const avatar = img
      ? `<img class="ph" src="${esc(img)}" alt="" />`
      : `<span class="ph ph-x">${esc((e.athleteName || '?').slice(0, 1).toUpperCase())}</span>`;
    const jersey = e.jerseyNumber != null ? `<span class="jn">${e.jerseyNumber}</span>` : '';
    return `<tr>
      <td class="p-name">${avatar}${jersey}<span class="nm">${esc(e.athleteName)}</span></td>
      <td class="p-st" style="background:${c.bg};color:${c.fg}">${e.status}</td>
      <td class="p-nt">${esc(e.note ?? '')}</td>
    </tr>`;
  }).join('');
  return `<table class="players">
    <thead><tr>
      <th class="p-name">${esc(r.labels.player)}</th>
      <th class="p-st">${esc(r.labels.status)}</th>
      <th class="p-nt">${esc(r.labels.notes)}</th>
    </tr></thead>
    <tbody>${rows || `<tr><td class="empty" colspan="3">—</td></tr>`}</tbody>
  </table>`;
}

function renderDensity(r: DailyReportData): string {
  // Sezione vuota ma dichiarata: un capitolo che sparisce senza spiegazione
  // fa sospettare un dato perso, e su un documento stampato non c'e' modo di
  // chiedere. Meglio una riga che dice perche' e' vuoto.
  if (r.density.length === 0) {
    return `<div class="page-break"></div><h2>${esc(r.labels.density)}</h2>
      <p class="empty-note">${esc(r.labels.noDensity)}</p>`;
  }
  const sections = r.density.map((d) => {
    // La scala e' la riga piu' lunga SOMMANDO i tre segmenti, non il solo
    // tempo totale: i segmenti stanno in fila, e scalando sul massimo dei
    // totali la riga piu' densa sfonderebbe la traccia e verrebbe compressa
    // dal flex, falsando il confronto fra gli esercizi.
    const maxRow = Math.max(1, ...d.drills.map((x) => x.totalMs + (x.perPlayerMs ?? 0) + (x.workMs ?? 0)));
    const bars = d.drills.map((x) => {
      const w = (x.totalMs / maxRow) * 100;
      const wWork = x.workMs != null ? (x.workMs / maxRow) * 100 : 0;
      const wPer = x.perPlayerMs != null ? (x.perPlayerMs / maxRow) * 100 : 0;
      return `<div class="bar-row">
        <div class="bar-lbl">${esc(x.name)}</div>
        <div class="bar-track">
          <div class="bar b-tot" style="width:${w.toFixed(2)}%"><span>${fmtMs(x.totalMs)}</span></div>
          ${wPer > 0 ? `<div class="bar b-per" style="width:${wPer.toFixed(2)}%"><span>${fmtMs(x.perPlayerMs!)}</span></div>` : ''}
          ${wWork > 0 ? `<div class="bar b-wrk" style="width:${wWork.toFixed(2)}%"><span>${fmtMs(x.workMs!)}</span></div>` : ''}
        </div>
      </div>`;
    }).join('');

    const drillRows = d.drills.map((x) => `<tr>
      <td>${esc(x.name)}</td>
      <td class="num">${fmtMs(x.totalMs)}</td>
      <td class="num">${x.perPlayerMs != null ? fmtMs(x.perPlayerMs) : ''}</td>
      <td class="num">${x.workMs != null ? fmtMs(x.workMs) : ''}</td>
    </tr>`).join('');

    return `<section class="dens">
      <h3>${esc(d.title)}${d.gameDayLabel ? ` <span class="gd">${esc(d.gameDayLabel)}</span>` : ''}</h3>
      <p class="dens-sub">${d.timeRange ? esc(d.timeRange) + ' · ' : ''}${d.athletesAvailable} ${esc(r.labels.athletes)} · ${fmtMs(d.totalMs)}</p>
      <div class="bars">${bars}</div>
      <div class="legend-bars">
        <span><i class="sw b-tot"></i>${esc(r.labels.totalTime)}</span>
        <span><i class="sw b-per"></i>${esc(r.labels.perPlayer)}</span>
        <span><i class="sw b-wrk"></i>${esc(r.labels.workOnly)}</span>
      </div>
      <table class="dt">
        <tr><th>${esc(r.labels.densityTable)}</th><th>${esc(r.labels.duration)}</th><th>%</th></tr>
        <tr><td>${esc(r.labels.activeTime)}</td><td class="num">${fmtMs(d.activeMs)}</td><td class="num">${d.densityPct}%</td></tr>
        <tr><td>${esc(r.labels.totalTime)}</td><td class="num">${fmtMs(d.totalMs)}</td><td></td></tr>
        <tr><td>${esc(r.labels.pauseTime)}</td><td class="num">${fmtMs(d.pauseMs)}</td><td class="num">${100 - d.densityPct}%</td></tr>
        <tr><td>${esc(r.labels.density)}</td><td colspan="2" class="band">${esc(r.labels[BAND_LABEL_KEY[d.densityBand]])}</td></tr>
      </table>
      <table class="dt">
        <tr>
          <th>${esc(r.labels.drill)}</th>
          <th>${esc(r.labels.totalTime)}</th>
          <th>${esc(r.labels.perPlayer)}</th>
          <th>${esc(r.labels.workOnly)}</th>
        </tr>
        ${drillRows}
        <tr class="tot">
          <td>${esc(r.labels.total)}</td>
          <td class="num">${fmtMs(d.totalMs)}</td>
          <td class="num">${fmtMs(d.activeMs)}</td>
          <td class="num">${fmtMs(d.drills.reduce((a, x) => a + (x.workMs ?? 0), 0))}</td>
        </tr>
      </table>
    </section>`;
  }).join('');

  return `<div class="page-break"></div><h2>${esc(r.labels.density)}</h2>${sections}`;
}

function renderLoad(r: DailyReportData): string {
  if (r.load.length === 0) {
    return `<section class="load"><h2>${esc(r.labels.loadSummary)}</h2>
      <p class="empty-note">${esc(r.labels.noLoad)}</p></section>`;
  }
  const srcLabel: Record<string, string> = {
    TRAINING: r.labels.sourceTraining, GAME: r.labels.sourceGame, MIXED: r.labels.sourceMixed,
  };
  const rows = r.load.map((l) => `<tr>
    <td>${esc(l.athleteName)}</td>
    <td class="num">${l.minutes}</td>
    <td class="num">${l.rpe ?? '—'}</td>
    <td class="num">${l.load ?? '—'}</td>
    <td>${esc(srcLabel[l.source] ?? l.source)}</td>
  </tr>`).join('');
  const totalLoad = r.load.reduce((a, l) => a + (l.load ?? 0), 0);
  return `<section class="load">
    <h2>${esc(r.labels.loadSummary)}</h2>
    <table class="dt">
      <tr>
        <th>${esc(r.labels.player)}</th><th>${esc(r.labels.minutes)}</th>
        <th>${esc(r.labels.rpe)}</th><th>${esc(r.labels.load)}</th><th>${esc(r.labels.source)}</th>
      </tr>
      ${rows}
      <tr class="tot"><td>${esc(r.labels.total)}</td><td></td><td></td><td class="num">${totalLoad}</td><td></td></tr>
    </table>
  </section>`;
}

function buildHtml(r: DailyReportData): string {
  const logo = safeImg(r.metadata.logoUrl);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 10px; margin: 0; }
  h2 { font-size: 13px; margin: 14px 0 6px; }
  h3 { font-size: 11px; margin: 10px 0 2px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #cbd5e1; padding: 3px 6px; vertical-align: middle; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { text-align: center; color: #94a3b8; }

  .head { display: flex; align-items: stretch; border: 1px solid #cbd5e1; margin-bottom: 6px; }
  .head .logo { width: 90px; display: flex; align-items: center; justify-content: center; border-right: 1px solid #cbd5e1; padding: 4px; }
  .head .logo img { max-width: 74px; max-height: 46px; }
  .head .mid { flex: 1; }
  .head .ttl { background: #1e293b; color: #fff; font-size: 16px; font-weight: 700; text-align: center; padding: 6px; letter-spacing: .04em; }
  .head .sub { display: flex; }
  .head .sub div { flex: 1; text-align: center; font-size: 13px; padding: 4px; border-top: 1px solid #cbd5e1; }
  .head .sub div + div { border-left: 1px solid #cbd5e1; }

  .top { display: flex; gap: 6px; margin-bottom: 8px; align-items: flex-start; }
  .acts { flex: 1; }
  .acts th { background: #e2e8f0; text-align: center; font-size: 10px; }
  .acts .a-m { width: 70px; text-align: center; font-weight: 600; }
  .legend { width: 190px; }
  .legend .lg-n { width: 34px; text-align: center; font-weight: 700; }
  .legend .lg-l { font-size: 9px; }

  .players th { background: #e2e8f0; text-align: center; font-size: 10px; }
  .players .p-name { width: 40%; }
  .players .p-st { width: 46px; text-align: center; font-weight: 700; font-size: 12px; }
  .players .p-nt { font-size: 9px; }
  .ph { width: 22px; height: 22px; border-radius: 4px; object-fit: cover; vertical-align: middle; margin-right: 5px; }
  .ph-x { display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-weight: 700; font-size: 10px; }
  .jn { display: inline-block; min-width: 16px; text-align: center; background: #1e293b; color: #fff; border-radius: 3px; font-size: 8px; padding: 1px 3px; margin-right: 4px; vertical-align: middle; }
  .nm { font-weight: 600; }

  .lines { border: 1px solid #cbd5e1; margin-top: 8px; }
  .lines .lh { background: #e2e8f0; font-weight: 700; padding: 4px 6px; font-size: 10px; }
  .lines .lb { padding: 6px; white-space: pre-wrap; min-height: 42px; font-size: 9.5px; }

  .page-break { page-break-before: always; }
  .dens { page-break-inside: avoid; margin-bottom: 12px; }
  .dens-sub { color: #64748b; margin: 0 0 6px; font-size: 9px; }
  .gd { background: #1e293b; color: #fff; border-radius: 3px; padding: 1px 5px; font-size: 9px; }
  .bar-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
  .bar-lbl { width: 120px; text-align: right; font-size: 9px; font-weight: 600; }
  .bar-track { flex: 1; display: flex; height: 15px; }
  .bar { flex: 0 0 auto; display: flex; align-items: center; justify-content: flex-end; padding-right: 4px; color: #fff; font-size: 7.5px; font-style: italic; overflow: hidden; white-space: nowrap; }
  .b-tot { background: #1d4ed8; }
  .b-per { background: #38bdf8; }
  .b-wrk { background: #94a3b8; }
  .legend-bars { display: flex; gap: 12px; font-size: 8.5px; margin: 4px 0 6px 126px; color: #334155; }
  .sw { display: inline-block; width: 8px; height: 8px; margin-right: 3px; }
  .dt { margin-bottom: 6px; }
  .dt th { background: #cbd5e1; text-align: left; font-size: 9px; }
  .dt td { font-size: 9px; }
  .dt .tot td { font-weight: 700; background: #f1f5f9; }
  .band { font-weight: 700; }
  .load { page-break-inside: avoid; }
  .empty-note { color: #64748b; font-style: italic; font-size: 9px; margin: 2px 0 8px; }
  .clin { page-break-inside: avoid; }
  .cl td, .cl th { font-size: 8px; padding: 2px 4px; }
  .cl .cl-name { font-weight: 600; white-space: nowrap; }
  </style></head><body>

  <div class="head">
    <div class="logo">${logo ? `<img src="${esc(logo)}" alt="" />` : `<strong>${esc(r.metadata.teamName || r.metadata.organizationName)}</strong>`}</div>
    <div class="mid">
      <div class="ttl">${esc(r.labels.reportTitle)}</div>
      <div class="sub"><div>${esc(r.weekdayLabel)}</div><div><strong>${esc(fmtDate(r.date))}</strong></div></div>
    </div>
  </div>

  <div class="top">${renderActivities(r)}${renderLegend(r)}</div>
  ${renderPlayers(r)}

  <div class="lines">
    <div class="lh">${esc(r.labels.teamLines)}</div>
    <div class="lb">${esc(r.teamLines ?? '')}</div>
  </div>

  ${renderClinical(r)}
  ${renderLoad(r)}
  ${renderDensity(r)}
  </body></html>`;
}

export async function renderDailyReportPdf(report: DailyReportData): Promise<Buffer> {
  return renderHtmlToPdf(buildHtml(report), {
    margin: { top: '10mm', right: '9mm', bottom: '12mm', left: '9mm' },
  });
}

/** Esposto per test e debug: l'HTML senza far partire Chrome. */
export function buildDailyReportHtml(report: DailyReportData): string {
  return buildHtml(report);
}
