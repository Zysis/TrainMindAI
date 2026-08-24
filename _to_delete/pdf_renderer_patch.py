# -*- coding: utf-8 -*-
"""Renderer PDF: non restare bloccati su un browser morto o su un lancio fallito."""
import io

p = 'trainmind-app/apps/api/src/services/report-renderer-pdf.ts'
s = io.open(p, encoding='utf-8').read()

old = """// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getBrowser(): Promise<any> {
  if (!browserPromise) {
    browserPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const puppeteer: any = await import('puppeteer').catch((err) => {
        throw new Error(
          `Puppeteer non installato. Esegui: pnpm add puppeteer --filter @trainmind/api. Dettagli: ${String(err)}`,
        );
      });
      return puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    })();
  }
  return browserPromise;
}"""

new = """// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
}"""

assert s.count(old) == 1, 'getBrowser non trovata'
s = s.replace(old, new)

# Nome dell'atleta nell'intestazione del PDF, sotto quella della squadra
old = """  const teamLine = metadata.teamName
    ? `<div style="font-size: 12px; color: #0d9488; font-weight: 600; margin-top: 2px;">Squadra: ${esc(metadata.teamName)}</div>`
    : '';"""
new = """  const teamLine = metadata.teamName
    ? `<div style="font-size: 12px; color: #0d9488; font-weight: 600; margin-top: 2px;">Squadra: ${esc(metadata.teamName)}</div>`
    : '';
  const athleteLine = metadata.athleteName
    ? `<div style="font-size: 12px; color: #0f172a; font-weight: 600; margin-top: 2px;">Atleta: ${esc(metadata.athleteName)}</div>`
    : '';"""
assert s.count(old) == 1, 'teamLine non trovata'
s = s.replace(old, new)

old = """        ${teamLine}
        <div style="font-size: 11px; color: #64748b;">Report periodico"""
new = """        ${teamLine}
        ${athleteLine}
        <div style="font-size: 11px; color: #64748b;">Report periodico"""
assert s.count(old) == 1, 'header teamLine non trovata'
s = s.replace(old, new)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched', p)

# ── DOCX: stessa riga ────────────────────────────────────────
p = 'trainmind-app/apps/api/src/services/report-renderer-docx.ts'
s = io.open(p, encoding='utf-8').read()
old = """  const sections: unknown[] = [];
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
  }"""
new = """  const sections: unknown[] = [];
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
  if (metadata.athleteName) {
    sections.push(new Paragraph({
      children: [
        new TextRun({
          text: `Atleta: ${metadata.athleteName}`,
          bold: true,
          size: 22,
        }),
      ],
      spacing: { after: 60 },
    }));
  }"""
assert s.count(old) == 1, 'blocco docx teamName non trovato'
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
print('patched', p)
