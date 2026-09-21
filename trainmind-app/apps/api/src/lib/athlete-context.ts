/**
 * Contesto atleta per l'AI
 * =========================
 *
 * Quando la chat (o il coach) ha un atleta selezionato, i suoi dati devono
 * arrivare al modello. Prima ci provava l'ai-service, richiamando l'API
 * all'indietro: non ha mai funzionato in nessun ambiente — chiamata senza
 * token (401), host scritto nel codice come `localhost` (dentro Docker punta a
 * sé stesso) e un endpoint wellness che non esiste. Il risultato era sempre
 * "profilo non disponibile".
 *
 * Adesso il riepilogo lo costruisce l'API, che i dati ce li ha già, e lo manda
 * nel corpo della richiesta. Due conseguenze, entrambe volute:
 *
 *  - non serve nessun token di servizio fra i due processi, né un URL interno
 *    da tenere allineato in tre file;
 *  - quello che esce verso il fornitore del modello si decide qui, in un punto
 *    solo, accanto alla mascheratura dei nomi. Nome, cognome, email e data di
 *    nascita non entrano: restano nel caveau.
 *    Vedi documentation/PIANO_SEPARAZIONE_IDENTITA.md
 */

import type { FastifyInstance } from 'fastify';

const WELLNESS_DAYS = 7;

/** Scala 1-5 dove 5 è sempre la condizione migliore, su tutte e cinque le voci. */
const SCALE_NOTE =
  'Scala 1-5 su tutte le voci, dove 5 è la condizione migliore e 1 la peggiore ' +
  '(fatica 1 = molto affaticato, 5 = per niente affaticato; stessa logica per dolore e stress).';

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Riepilogo testuale dell'atleta, senza identificatori.
 *
 * Restituisce `null` quando l'atleta non esiste o non appartiene
 * all'organizzazione di chi chiede: in quel caso il chiamante non aggiunge
 * nulla alla richiesta.
 */
export async function buildAthleteContext(
  app: FastifyInstance,
  athleteId: string,
  organizationId: string,
): Promise<string | null> {
  const athlete = await app.prisma.athlete.findFirst({
    // Il filtro sull'organizzazione non è una formalità: senza, un id
    // indovinato darebbe i dati sanitari di un atleta di un altro club.
    where: { id: athleteId, organizationId },
    select: {
      birthYear: true,
      position: true,
      height: true,
      weight: true,
    },
  });

  if (!athlete) return null;

  const since = new Date();
  since.setDate(since.getDate() - WELLNESS_DAYS);

  const [wellness, injuries] = await Promise.all([
    app.prisma.wellnessLog.findMany({
      where: { athleteId, date: { gte: since } },
      select: {
        date: true,
        sleepHours: true,
        sleepQuality: true,
        fatigue: true,
        soreness: true,
        stress: true,
        mood: true,
      },
      orderBy: { date: 'desc' },
      take: WELLNESS_DAYS,
    }),
    app.prisma.injury.findMany({
      where: { athleteId, status: { not: 'RESOLVED' } },
      select: {
        type: true,
        location: true,
        severity: true,
        status: true,
        dateOccurred: true,
      },
      orderBy: { dateOccurred: 'desc' },
      take: 5,
    }),
  ]);

  const lines: string[] = [];

  const age = new Date().getFullYear() - athlete.birthYear;
  const profile = [
    athlete.position,
    `${age} anni`,
    athlete.height ? `${athlete.height} cm` : null,
    athlete.weight ? `${athlete.weight} kg` : null,
  ].filter(Boolean);
  lines.push(`PROFILO ATLETA: ${profile.join(', ')}.`);

  if (wellness.length > 0) {
    lines.push('', `WELLNESS ULTIMI ${WELLNESS_DAYS} GIORNI. ${SCALE_NOTE}`);
    for (const w of wellness) {
      lines.push(
        `- ${isoDay(w.date)}: sonno ${w.sleepQuality}/5` +
          (w.sleepHours != null ? ` (${w.sleepHours} h)` : '') +
          `, fatica ${w.fatigue}/5, dolore ${w.soreness}/5, stress ${w.stress}/5, umore ${w.mood}/5`,
      );
    }
  } else {
    lines.push('', `WELLNESS: nessuna registrazione negli ultimi ${WELLNESS_DAYS} giorni.`);
  }

  if (injuries.length > 0) {
    lines.push('', 'INFORTUNI ATTIVI:');
    for (const i of injuries) {
      lines.push(
        `- ${i.type} — ${i.location} (gravità ${i.severity}/5, stato ${i.status}, dal ${isoDay(i.dateOccurred)})`,
      );
    }
  } else {
    lines.push('', 'INFORTUNI ATTIVI: nessuno.');
  }

  return lines.join('\n');
}
