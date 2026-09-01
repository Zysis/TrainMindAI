/**
 * Report post-partita — resa PDF.
 *
 * Riusa lo stesso Chrome degli altri report tramite `renderHtmlToPdf`, ma ha
 * un impaginato proprio: la pagina e' un tabellone con due squadre, un
 * punteggio e una tabella di disponibilita' a celle colorate.
 *
 * Le foto e i loghi arrivano come data URL dal database: nessuna richiesta di
 * rete parte dalla pagina, quindi il PDF non dipende da un CDN raggiungibile.
 */

import type { GameReportData, GameReportPlayer } from '@trainmind/types';
import { renderHtmlToPdf } from './report-renderer-pdf.js';

/** Scala 0-5 del foglio cartaceo: 0 rosso, 5 verde. */
const STATUS_COLORS: Record<number, { bg: string; fg: string }> = {
  0: { bg: '#f2706e', fg: '#4a1010' },
  1: { bg: '#f5945c', fg: '#4a2410' },
  2: { bg: '#f7c45c', fg: '#4a3410' },
  3: { bg: '#dfe06a', fg: '#3f4210' },
  4: { bg: '#93cf85', fg: '#16401a' },
  5: { bg: '#48bf8a', fg: '#0b3d28' },
};

const ZONE_COLOR: Record<string, string> = {
  low: '#0284c7', optimal: '#059669', high: '#d97706', danger: '#dc2626',
};
const ZONE_LABEL_KEY: Record<string, string> = {
  low: 'zoneLow', optimal: 'zoneOptimal', high: 'zoneHigh', danger: 'zoneDanger',
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Solo data URL: un URL esterno in `src` farebbe uscire una richiesta. */
function safeImg(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(url) ? url : null;
}

function fmtMin(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function avatar(p: GameReportPlayer): string {
  const img = safeImg(p.photoUrl);
  return img
    ? `<img class="ph" src="${esc(img)}" alt="" />`
    : `<span class="ph ph-x">${esc((p.athleteName || '?').slice(0, 1).toUpperCase())}</span>`;
}

function nameCell(p: GameReportPlayer): string {
  const jersey = p.jerseyNumber != null ? `<span class="jn">${p.jerseyNumber}</span>` : '';
  return `${avatar(p)}${jersey}<span class="nm">${esc(p.athleteName)}</span>`;
}

// ─── Sezioni ────────────────────────────────────────────

function renderScoreboard(r: GameReportData): string {
  const logo = safeImg(r.metadata.logoUrl);
  const score = r.homeScore != null && r.awayScore != null
    ? `${r.homeScore} - ${r.awayScore}`
    : '—';
  return `<div class="head">
    <div class="ttl">${esc(r.labels.reportTitle)}</div>
    <div class="sub">${esc(r.dateLabel.toUpperCase())} · ${esc(r.timeLabel)}${r.venue ? ` · ${esc(r.venue)}` : ''}</div>
    ${r.competition ? `<div class="comp">${esc(r.competition)}</div>` : ''}
    <div class="board">
      <div class="tm">${logo && r.isHome !== false ? `<img class="lg" src="${esc(logo)}" alt="" />` : ''}<span>${esc(r.homeTeamName)}</span></div>
      <div class="sc">${esc(score)}</div>
      <div class="tm">${logo && r.isHome === false ? `<img class="lg" src="${esc(logo)}" alt="" />` : ''}<span>${esc(r.awayTeamName)}</span></div>
    </div>
  </div>`;
}

/** La tabella del foglio cartaceo: minuti, aspettative 0-5, note. */
function renderReadiness(r: GameReportData): string {
  if (r.players.length === 0) {
    return `<h2>${esc(r.labels.readinessTitle)}</h2><p class="empty-note">${esc(r.labels.noPlayers)}</p>`;
  }
  const rows = r.players.map((p) => {
    const c = p.readiness != null ? STATUS_COLORS[p.readiness] : null;
    const min = p.totalPlayingMs > 0 ? fmtMin(p.totalPlayingMs) : r.labels.dnp;
    return `<tr>
      <td class="p-name">${nameCell(p)}</td>
      <td class="p-min">${esc(min)}</td>
      <td class="p-st"${c ? ` style="background:${c.bg};color:${c.fg}"` : ''}>${p.readiness ?? ''}</td>
      <td class="p-nt">${esc(p.readinessNote ?? '')}</td>
    </tr>`;
  }).join('');
  const legend = [5, 4, 3, 2, 1, 0].map((n) => {
    const c = STATUS_COLORS[n];
    return `<span class="lg-i"><i style="background:${c.bg};color:${c.fg}">${n}</i>${esc(r.statusLabels[String(n)] ?? '')}</span>`;
  }).join('');
  return `<h2>${esc(r.labels.readinessTitle)}</h2>
    <div class="legend">${legend}</div>
    <table class="players">
      <thead><tr>
        <th class="p-name">${esc(r.labels.player)}</th>
        <th class="p-min">${esc(r.labels.minutes)}</th>
        <th class="p-st">${esc(r.labels.trainingExpectation)}</th>
        <th class="p-nt">${esc(r.labels.notes)}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderSummary(r: GameReportData): string {
  const s = r.summary;
  const cells: Array<[string, string]> = [
    [r.labels.playersUsed, `${s.playersUsed} / ${s.playersDressed}`],
    [r.labels.totalMinutes, `${s.totalMinutes} / ${s.expectedMinutes}`],
    [r.labels.avgRpe, s.avgRpe != null ? String(s.avgRpe) : '—'],
    [r.labels.totalLoad, s.totalLoad > 0 ? String(s.totalLoad) : '—'],
    [r.labels.avgStints, s.avgStintsPerPlayer != null ? String(s.avgStintsPerPlayer) : '—'],
    [r.labels.totalBreaks, String(s.totalBreaks)],
  ];
  return `<h2>${esc(r.labels.summaryTitle)}</h2>
    <div class="tiles">${cells.map(([k, v]) =>
      `<div class="tile"><span class="tk">${esc(k)}</span><span class="tv">${esc(v)}</span></div>`).join('')}</div>`;
}

function renderLoad(r: GameReportData): string {
  const rows = r.players.filter((p) => p.totalPlayingMs > 0);
  if (rows.length === 0) return '';
  const body = rows.map((p) => {
    const zc = p.acwrZone ? ZONE_COLOR[p.acwrZone] : '';
    const delta = p.minutesDelta;
    const deltaTxt = delta == null ? '' : `${delta > 0 ? '+' : ''}${delta}`;
    return `<tr>
      <td>${esc(p.athleteName)}</td>
      <td class="num">${p.minutes}</td>
      <td class="num">${p.rpe ?? '—'}</td>
      <td class="num">${p.load ?? '—'}</td>
      <td class="num">${p.seasonAvgMinutes ?? '—'}</td>
      <td class="num"${delta != null && delta !== 0 ? ` style="color:${delta > 0 ? '#059669' : '#dc2626'}"` : ''}>${esc(deltaTxt)}</td>
      <td class="num"${zc ? ` style="color:${zc};font-weight:700"` : ''}>${p.acwr ?? '—'}</td>
      <td class="zn"${zc ? ` style="color:${zc}"` : ''}>${p.acwrZone ? esc(r.labels[ZONE_LABEL_KEY[p.acwrZone]]) : ''}</td>
    </tr>`;
  }).join('');
  return `<h2>${esc(r.labels.loadTitle)}</h2>
    <table class="dt">
      <tr>
        <th>${esc(r.labels.player)}</th><th>${esc(r.labels.minutes)}</th>
        <th>${esc(r.labels.rpe)}</th><th>${esc(r.labels.load)}</th>
        <th>${esc(r.labels.seasonAvg)}</th><th>${esc(r.labels.delta)}</th>
        <th>${esc(r.labels.acwr)}</th><th></th>
      </tr>
      ${body}
      <tr class="tot">
        <td>${esc(r.labels.total)}</td>
        <td class="num">${r.summary.totalMinutes}</td>
        <td class="num">${r.summary.avgRpe ?? '—'}</td>
        <td class="num">${r.summary.totalLoad || '—'}</td>
        <td colspan="4"></td>
      </tr>
    </table>`;
}

/** Turni in campo: minuti per periodo, barre e dettaglio dei turni. */
function renderStints(r: GameReportData): string {
  const played = r.players.filter((p) => p.stints.length > 0);
  if (played.length === 0) return '';
  const qDur = Math.max(1, r.quarterDurationMs);

  const head = r.periodLabels.map((l) => `<th class="num">${esc(l)}</th>`).join('');
  const perPeriod = played.map((p) => {
    const cells = r.periodLabels.map((_, i) => {
      const ms = p.msByPeriod[String(i + 1)] ?? 0;
      return `<td class="num">${ms > 0 ? fmtMin(ms) : ''}</td>`;
    }).join('');
    return `<tr><td>${esc(p.athleteName)}</td>${cells}<td class="num tb">${fmtMin(p.totalPlayingMs)}</td></tr>`;
  }).join('');

  // Una barra per giocatore: i periodi in fila, ogni turno posizionato dove
  // e' realmente avvenuto dentro il suo periodo.
  const bars = played.map((p) => {
    const segs = p.stints.map((st) => {
      const left = ((st.quarter - 1) * qDur + st.inMs) / (r.periodLabels.length * qDur) * 100;
      const width = st.durationMs / (r.periodLabels.length * qDur) * 100;
      const title = `${st.periodLabel} · ${fmtMin(st.durationMs)}${st.breaks > 0 ? ` · ${st.breaks} ${r.labels.breaks}` : ''}`;
      return `<div class="seg" style="left:${left.toFixed(2)}%;width:${Math.max(width, 0.4).toFixed(2)}%" title="${esc(title)}"></div>`;
    }).join('');
    const ticks = r.periodLabels.slice(1).map((_, i) =>
      `<div class="tick" style="left:${((i + 1) / r.periodLabels.length * 100).toFixed(2)}%"></div>`).join('');
    return `<div class="bar-row">
      <div class="bar-lbl">${esc(p.athleteName)}</div>
      <div class="bar-track">${ticks}${segs}</div>
      <div class="bar-tot">${fmtMin(p.totalPlayingMs)}</div>
    </div>`;
  }).join('');

  const detail = played.map((p) => {
    const chips = p.stints.map((st, i) =>
      `<span class="chip">${i + 1}. ${esc(st.periodLabel)} ${fmtMin(st.durationMs)}${
        st.breaks > 0 ? `<b>⏸${st.breaks}</b>` : ''}</span>`).join('');
    return `<tr><td class="sd-n">${esc(p.athleteName)}</td><td>${chips}</td>
      <td class="num">${p.stintCount}</td><td class="num">${p.breakCount}</td></tr>`;
  }).join('');

  return `<div class="page-break"></div>
    <h2>${esc(r.labels.stintsTitle)}</h2>
    <h3>${esc(r.labels.stintsPerPeriod)}</h3>
    <table class="dt">
      <tr><th>${esc(r.labels.player)}</th>${head}<th class="num">${esc(r.labels.total)}</th></tr>
      ${perPeriod}
    </table>
    <h3>${esc(r.labels.onCourt)}</h3>
    <div class="bars">${bars}</div>
    <h3>${esc(r.labels.stintDetail)}</h3>
    <table class="dt">
      <tr><th>${esc(r.labels.player)}</th><th>${esc(r.labels.stint)}</th>
        <th class="num">${esc(r.labels.stintCount)}</th><th class="num">${esc(r.labels.breaks)}</th></tr>
      ${detail}
    </table>`;
}

function buildHtml(r: GameReportData): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 10px; margin: 0; }
  h2 { font-size: 13px; margin: 14px 0 6px; }
  h3 { font-size: 10.5px; margin: 10px 0 4px; color: #334155; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #cbd5e1; padding: 3px 6px; vertical-align: middle; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .empty-note { color: #64748b; font-style: italic; font-size: 9px; }

  .head { border: 1px solid #cbd5e1; margin-bottom: 8px; }
  .head .ttl { background: #1e293b; color: #fff; font-size: 15px; font-weight: 700; text-align: center; padding: 6px; letter-spacing: .05em; }
  .head .sub { text-align: center; font-size: 10px; padding: 4px; color: #475569; border-top: 1px solid #cbd5e1; }
  .head .comp { text-align: center; font-size: 9px; padding: 0 0 4px; color: #64748b; font-weight: 600; }
  .board { display: flex; align-items: center; border-top: 1px solid #cbd5e1; }
  .board .tm { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; font-size: 13px; font-weight: 700; }
  .board .lg { max-height: 34px; max-width: 60px; }
  .board .sc { width: 130px; text-align: center; font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; padding: 6px; }

  .legend { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; font-size: 8px; color: #475569; }
  .lg-i i { display: inline-block; width: 12px; text-align: center; font-style: normal; font-weight: 700; margin-right: 3px; border-radius: 2px; }

  .players th { background: #e2e8f0; text-align: center; font-size: 9px; }
  .players .p-name { width: 34%; }
  .players .p-min { width: 52px; text-align: center; font-variant-numeric: tabular-nums; }
  .players .p-st { width: 82px; text-align: center; font-weight: 700; font-size: 12px; }
  .players .p-nt { font-size: 9px; }
  .ph { width: 20px; height: 20px; border-radius: 4px; object-fit: cover; vertical-align: middle; margin-right: 5px; }
  .ph-x { display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; font-weight: 700; font-size: 9px; }
  .jn { display: inline-block; min-width: 15px; text-align: center; background: #1e293b; color: #fff; border-radius: 3px; font-size: 7.5px; padding: 1px 3px; margin-right: 4px; vertical-align: middle; }
  .nm { font-weight: 600; }

  .tiles { display: flex; flex-wrap: wrap; gap: 5px; }
  .tile { flex: 1 1 15%; border: 1px solid #cbd5e1; border-radius: 4px; padding: 5px 7px; }
  .tk { display: block; font-size: 7.5px; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
  .tv { display: block; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }

  .dt th { background: #cbd5e1; text-align: left; font-size: 9px; }
  .dt td { font-size: 9px; }
  .dt .tot td { font-weight: 700; background: #f1f5f9; }
  .dt .tb { font-weight: 700; }
  .zn { font-size: 8px; }

  .bar-row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
  .bar-lbl { width: 110px; text-align: right; font-size: 8.5px; font-weight: 600; }
  .bar-track { position: relative; flex: 1; height: 13px; background: #e2e8f0; border-radius: 2px; overflow: hidden; }
  .seg { position: absolute; top: 0; height: 100%; background: #1d4ed8; border-radius: 2px; }
  .tick { position: absolute; top: 0; height: 100%; width: 1px; background: #94a3b8; }
  .bar-tot { width: 42px; text-align: right; font-size: 8.5px; font-variant-numeric: tabular-nums; font-weight: 600; }

  .chip { display: inline-block; background: #f1f5f9; border-radius: 3px; padding: 1px 4px; margin: 1px 2px 1px 0; font-size: 8px; font-variant-numeric: tabular-nums; }
  .chip b { color: #d97706; margin-left: 3px; }
  .sd-n { white-space: nowrap; font-weight: 600; }

  .page-break { page-break-before: always; }
  </style></head><body>
  ${renderScoreboard(r)}
  ${renderReadiness(r)}
  ${renderSummary(r)}
  ${renderLoad(r)}
  ${renderStints(r)}
  </body></html>`;
}

export async function renderGameReportPdf(report: GameReportData): Promise<Buffer> {
  return renderHtmlToPdf(buildHtml(report), {
    margin: { top: '10mm', right: '9mm', bottom: '12mm', left: '9mm' },
  });
}

/** Esposto per test e debug: l'HTML senza far partire Chrome. */
export function buildGameReportHtml(report: GameReportData): string {
  return buildHtml(report);
}
