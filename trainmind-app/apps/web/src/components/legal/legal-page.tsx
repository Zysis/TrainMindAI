'use client';

/**
 * Pagina legale (Termini, Privacy, Cookie) nella lingua scelta dall'utente.
 *
 * La lingua segue `useLocaleStore`, lo stesso store del resto dell'app: chi
 * mette il sito in inglese e apre i Termini li trova in inglese, senza
 * ricaricare. Se un documento non esistesse nella lingua attiva si ripiega
 * sull'italiano, che e' la versione ufficiale (v. clausola "controlling
 * version" nei documenti).
 *
 * I testi arrivano da `@/lib/legal/content`, generato dalla stessa fonte dei
 * .docx nella cartella `legal/` del progetto.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocaleStore, localeLabels, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/store';
import {
  LEGAL_CONTENT,
  LEGAL_PATHS,
  type LegalBlock,
  type LegalDocKey,
} from '@/lib/legal/content';

/** Etichette del menu fra documenti, nelle tre lingue. */
const NAV_LABELS: Record<Locale, Record<LegalDocKey, string>> = {
  it: { terms: 'Termini di Servizio', privacy: 'Informativa Privacy', cookies: 'Cookie Policy' },
  en: { terms: 'Terms of Service', privacy: 'Privacy Policy', cookies: 'Cookie Policy' },
  es: { terms: 'Términos de Servicio', privacy: 'Política de Privacidad', cookies: 'Política de Cookies' },
};

const BACK_LABEL: Record<Locale, string> = {
  it: '← Torna al sito',
  en: '← Back to the site',
  es: '← Volver al sitio',
};

const LANG_HINT: Record<Locale, string> = {
  it: 'Documento disponibile anche in altre lingue:',
  en: 'This document is also available in other languages:',
  es: 'Documento disponible también en otros idiomas:',
};

const DOC_ORDER: LegalDocKey[] = ['terms', 'privacy', 'cookies'];

const TOC_LABEL: Record<Locale, string> = {
  it: 'In questa pagina',
  en: 'On this page',
  es: 'En esta página',
};

/** Ancora stabile per ogni sezione, indipendente dalla lingua. */
function sectionId(index: number) {
  return `s-${index + 1}`;
}

/**
 * Evidenzia nell'indice la sezione in cima allo schermo.
 * La fascia di osservazione esclude la barra superiore e gran parte
 * della metà inferiore, così l'evidenza segue la lettura.
 */
function useActiveSection(count: number, enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || count === 0 || typeof IntersectionObserver === 'undefined') return;

    const ids = Array.from({ length: count }, (_, i) => sectionId(i));
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((n): n is HTMLElement => n !== null);
    const visible = new Set<string>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        setActive(ids.find((id) => visible.has(id)) ?? null);
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [count, enabled]);

  return active;
}

/**
 * Rende il grassetto scritto come **testo**. I documenti legali usano
 * questa marcatura per evidenziare definizioni e clausole importanti.
 */
function RichText({ children }: { children: string }) {
  const parts = children.split('**');
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-slate-900">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === 'p') {
    return (
      <p className="mb-4 leading-[1.8]">
        <RichText>{block.text}</RichText>
      </p>
    );
  }

  if (block.type === 'ul') {
    return (
      <ul className="mb-5 list-disc space-y-2.5 pl-5 marker:text-teal-600">
        {block.items.map((item, i) => (
          <li key={i} className="leading-[1.75] pl-1">
            <RichText>{item}</RichText>
          </li>
        ))}
      </ul>
    );
  }

  // Le tabelle non hanno il vincolo della lunghezza di riga: su schermo
  // largo escono dalla colonna del testo (-mr) e usano lo spazio a destra.
  // Su mobile scorrono in orizzontale invece di rompere il layout.
  return (
    <div className="mb-6 overflow-x-auto lg:-mr-24 xl:-mr-32">
      <table className="w-full min-w-[34rem] border-collapse text-[13.5px]">
        <thead>
          <tr>
            {block.head.map((h, i) => (
              <th
                key={i}
                className="border border-slate-200 bg-slate-50 px-4 py-2.5 text-left font-semibold text-slate-700"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r} className="even:bg-slate-50/60">
              {row.map((cell, c) => (
                <td
                  key={c}
                  className="border border-slate-200 px-4 py-2.5 align-top leading-[1.65]"
                >
                  <RichText>{cell}</RichText>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalPage({ doc }: { doc: LegalDocKey }) {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  // Lo store legge localStorage, che sul server non esiste: fino al mount
  // usiamo la lingua di default dell'app, la stessa con cui si presenta il
  // resto del sito, così non c'è un cambio di lingua a schermo dopo il primo
  // render. Dopo il mount vale la scelta salvata dall'utente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active: Locale = mounted ? locale : DEFAULT_LOCALE;

  // Se un documento mancasse nella lingua attiva si ripiega sull'italiano,
  // che è la versione ufficiale (clausola "controlling version" nei testi).
  const content = LEGAL_CONTENT[doc][active] ?? LEGAL_CONTENT[doc].it;
  const labels = NAV_LABELS[active];

  useEffect(() => {
    if (mounted) document.documentElement.lang = active;
  }, [mounted, active]);

  const activeSection = useActiveSection(content.sections.length, mounted);

  return (
    <div className="min-h-screen bg-white">
      {/* Barra dei documenti: sticky, così i tre link e il ritorno al sito
          restano raggiungibili anche a metà di un testo lungo. */}
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] flex-wrap gap-x-6 gap-y-2 px-6 py-3.5 text-[13px]">
          {DOC_ORDER.map((key) =>
            key === doc ? (
              <span key={key} className="font-semibold text-teal-700">
                {labels[key]}
              </span>
            ) : (
              <Link key={key} href={LEGAL_PATHS[key]} className="text-slate-500 hover:text-teal-700">
                {labels[key]}
              </Link>
            ),
          )}
          <Link href="/" className="ml-auto text-slate-400 hover:text-teal-700">
            {BACK_LABEL[active]}
          </Link>
        </div>
      </nav>

      {/* Due colonne su schermo largo: indice fisso + testo. La colonna di
          testo resta stretta di proposito — oltre ~90 caratteri per riga la
          lettura peggiora — e lo spazio in più va a indice e tabelle. */}
      <div className="mx-auto grid max-w-[1240px] gap-x-16 px-6 py-12 text-[15px] text-slate-700 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
            {TOC_LABEL[active]}
          </h2>
          <ol className="space-y-2.5 border-l border-slate-200 pl-4 text-[13px] leading-snug">
            {content.sections.map((section, i) => (
              <li key={i}>
                <a
                  href={`#${sectionId(i)}`}
                  className={
                    activeSection === sectionId(i)
                      ? 'block font-medium text-slate-900'
                      : 'block text-slate-500 transition-colors hover:text-teal-700'
                  }
                >
                  {section.h}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article className="max-w-[74ch]">
          <h1 className="mb-1.5 text-4xl font-bold tracking-tight text-slate-900">
            {content.title}
          </h1>
          <p className="mb-5 text-[13px] text-slate-500">{content.updated}</p>

          {/* Selettore lingua: cambia il documento mostrato e la lingua dell'app */}
          <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-6 text-[13px]">
            <span className="text-slate-500">{LANG_HINT[active]}</span>
            {(Object.keys(NAV_LABELS) as Locale[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                aria-current={l === active ? 'true' : undefined}
                className={
                  l === active
                    ? 'rounded border border-teal-700 bg-teal-700 px-2.5 py-1 font-medium text-white'
                    : 'rounded border border-slate-300 px-2.5 py-1 text-slate-600 transition-colors hover:border-teal-700 hover:text-teal-700'
                }
              >
                {localeLabels[l]}
              </button>
            ))}
          </div>

          {/* Riquadro "In breve" */}
          {content.tldr && (
            <aside className="mb-10 rounded-lg border border-slate-200 bg-slate-50 p-6">
              <h2 className="mb-3 text-[15px] font-semibold text-slate-900">
                {content.tldr.title}
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-[14px] marker:text-teal-600">
                {content.tldr.items.map((item, i) => (
                  <li key={i} className="leading-[1.7]">
                    <RichText>{item}</RichText>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          {content.intro.map((block, i) => (
            <Block key={`intro-${i}`} block={block} />
          ))}

          {content.sections.map((section, i) => (
            <section key={i} className="mt-12 scroll-mt-24" id={sectionId(i)}>
              <h2 className="mb-3.5 text-xl font-semibold tracking-tight text-slate-900">
                {section.h}
              </h2>
              {section.blocks.map((block, j) => (
                <Block key={j} block={block} />
              ))}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
