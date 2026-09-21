/**
 * Pseudonimi per i prompt AI
 * ===========================
 *
 * I dati di allenamento e wellness vengono mandati a un fornitore di modelli
 * fuori dalla nostra infrastruttura. Non c'e' motivo per cui debbano viaggiare
 * con nome e cognome: al modello serve sapere che "A1 dorme 4 ore da tre
 * giorni", non chi sia A1.
 *
 * Qui dentro: prima di costruire il prompt ogni atleta riceve un'etichetta
 * (`A1`, `A2`, …), e quando la risposta torna le etichette vengono rimpiazzate
 * dal nome vero. Il preparatore legge "Marco Rossi" come sempre; il fornitore
 * del modello non lo ha mai visto.
 *
 * La mappa vive SOLO in memoria e SOLO per la durata della richiesta: niente
 * tabella, niente cache, niente da cancellare dopo.
 *
 * Restano fuori dalla portata di questo meccanismo i testi che il preparatore
 * scrive di suo pugno nella chat: se ci mette dentro un cognome, quel cognome
 * parte. E' una scelta dell'utente, non un percorso automatico.
 */

import { fullName } from './identity.js';

type WithIdentity = {
  id?: string;
  identity?: { firstName: string; lastName: string } | null;
} | null | undefined;

export interface Pseudonymizer {
  /** Etichetta da usare nel prompt al posto del nome. */
  label(athlete: WithIdentity): string;
  /** Rimette i nomi veri nel testo che torna dal modello. */
  restore(text: string): string;
  /** Quante etichette sono state emesse (per i log, senza nomi). */
  size(): number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Toglie dal testo scritto dal preparatore il nome dell'atleta selezionato,
 * sostituendolo con un riferimento neutro.
 *
 * Serve al percorso chat/coach: la domanda "come sta Marco Sartori?" arriva al
 * modello come "come sta l'atleta?", mentre i dati di quell'atleta sono gia'
 * nel contesto costruito dall'ai-service. La risposta resta sensata e il nome
 * non esce.
 *
 * Si sostituisce anche il solo cognome e il solo nome: con l'atleta gia'
 * selezionato non c'e' ambiguita' su chi sia "Sartori".
 */
export function maskSelectedAthleteName(
  text: string,
  identity: { firstName: string; lastName: string } | null | undefined,
  replacement = "l'atleta",
): string {
  if (!text || !identity) return text;
  const { firstName, lastName } = identity;
  if (!firstName && !lastName) return text;

  const first = escapeRegExp(firstName.trim());
  const last = escapeRegExp(lastName.trim());

  // Prima le forme lunghe: sostituendo prima il solo cognome, "Marco Sartori"
  // diventerebbe "Marco l'atleta".
  const patterns = [
    first && last ? `${first}\\s+${last}` : '',
    first && last ? `${last}\\s+${first}` : '',
    last,
    first,
  ].filter((p) => p.length > 1);

  let out = text;
  for (const p of patterns) {
    out = out.replace(new RegExp(`\\b${p}\\b`, 'gi'), replacement);
  }
  return out;
}

export function createPseudonymizer(): Pseudonymizer {
  const labelByKey = new Map<string, string>();
  const nameByLabel = new Map<string, string>();
  let next = 1;

  return {
    label(athlete) {
      const key = athlete?.id ?? `anon-${next}`;
      const existing = labelByKey.get(key);
      if (existing) return existing;

      const tag = `A${next++}`;
      labelByKey.set(key, tag);
      const real = fullName(athlete);
      if (real) nameByLabel.set(tag, real);
      return tag;
    },

    restore(text) {
      if (!text) return text;
      let out = text;
      // Dalle etichette piu' lunghe alle piu' corte: senza, `A1` mangerebbe
      // il prefisso di `A12` e la risposta uscirebbe con "Marco Rossi2".
      const tags = [...nameByLabel.keys()].sort((a, b) => b.length - a.length);
      for (const tag of tags) {
        out = out.replace(new RegExp(`\\b${tag}\\b`, 'g'), nameByLabel.get(tag) as string);
      }
      return out;
    },

    size() {
      return labelByKey.size;
    },
  };
}
