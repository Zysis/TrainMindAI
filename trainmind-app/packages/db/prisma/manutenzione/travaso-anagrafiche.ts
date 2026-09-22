/**
 * FASE 2 — Travaso delle anagrafiche rimaste in chiaro
 * ====================================================
 *
 * Legge le righe di `athlete_identities` che non hanno ancora il prefisso
 * `v1:` e le riscrive cifrate. Niente migration SQL: la cifratura avviene in
 * Node, non in Postgres.
 *
 * Principio, lo stesso del vault: NIENTE E' DISTRUTTIVO FINCHE' LA VERIFICA
 * NON E' PASSATA. In concreto:
 *
 *   1. si legge con il client GREZZO, senza estensioni, cosi' si vede cio'
 *      che sta davvero su disco e non cio' che l'API fa vedere;
 *   2. ogni valore viene cifrato E SUBITO RIDECIFRATO in memoria, e il
 *      risultato confrontato con l'originale. Se anche un solo campo non
 *      torna, il programma si ferma PRIMA di aver scritto qualsiasi cosa;
 *   3. le scritture stanno in una transazione;
 *   4. dopo il commit si rilegge tutto dal database e si ridecifra, per
 *      verificare sui byte davvero salvati.
 *
 * Senza argomenti non scrive niente: dice solo cosa farebbe.
 *
 *   tsx travaso-anagrafiche.ts            prova a vuoto
 *   tsx travaso-anagrafiche.ts --esegui   travaso vero
 *   tsx travaso-anagrafiche.ts --verifica ricontrolla e basta
 *
 * Sul VPS gira dal servizio `migrate`, l'unico costruito con i sorgenti
 * completi e con la chiave montata:
 *
 *   dc --profile tools run --rm --entrypoint sh migrate -c \
 *     'pnpm --filter @trainmind/db exec tsx prisma/manutenzione/travaso-anagrafiche.ts'
 */
import { PrismaClient } from '@prisma/client';
import {
  cifra,
  decifra,
  eCifrato,
  chiaveDaFile,
  inizializzaCifratura,
  impronta,
} from '../../src/identity-cifratura.js';

const CAMPI = ['firstName', 'lastName', 'email', 'photoUrl'] as const;
type Campo = (typeof CAMPI)[number];

const esegui = process.argv.includes('--esegui');
const soloVerifica = process.argv.includes('--verifica');

// Client GREZZO: niente estensioni. Deve mostrare i byte, non i nomi.
const prisma = new PrismaClient();

function apriChiave(): void {
  const percorso = process.env.IDENTITY_KEY_FILE;
  if (!percorso) {
    throw new Error(
      'IDENTITY_KEY_FILE non impostata. Senza chiave questo script non ha niente da fare.',
    );
  }
  const chiave = chiaveDaFile(percorso);
  inizializzaCifratura(chiave);
  console.log(`chiave caricata — impronta ${impronta(chiave)}`);
  console.log('Deve coincidere con quella che l\'API stampa all\'avvio.\n');
}

async function stato() {
  const righe = await prisma.athleteIdentity.findMany({
    select: { athleteId: true, firstName: true, lastName: true, email: true, photoUrl: true },
  });
  const conta = { totale: righe.length, daFare: 0, gia: 0, miste: 0 };
  for (const r of righe) {
    const pieni = CAMPI.map((c) => r[c]).filter((v) => v !== null && v !== undefined && v !== '');
    const cifrati = pieni.filter(eCifrato).length;
    if (cifrati === 0) conta.daFare++;
    else if (cifrati === pieni.length) conta.gia++;
    else conta.miste++;
  }
  return { righe, conta };
}

/** Rilegge dal database e ridecifra: la verifica che conta e' sui byte salvati. */
async function verificaSuDisco(attesi: Map<string, Partial<Record<Campo, string>>>) {
  const righe = await prisma.athleteIdentity.findMany({
    where: { athleteId: { in: [...attesi.keys()] } },
    select: { athleteId: true, firstName: true, lastName: true, email: true, photoUrl: true },
  });

  let ok = 0;
  const guasti: string[] = [];
  for (const r of righe) {
    const atteso = attesi.get(r.athleteId)!;
    for (const campo of CAMPI) {
      const originale = atteso[campo];
      if (originale === undefined) continue;
      const salvato = r[campo];
      if (!eCifrato(salvato)) {
        guasti.push(`${r.athleteId}.${campo}: non e' cifrato su disco`);
        continue;
      }
      let aperto: string | null;
      try {
        aperto = decifra(salvato, r.athleteId);
      } catch (e) {
        guasti.push(`${r.athleteId}.${campo}: non si riapre (${(e as Error).message})`);
        continue;
      }
      if (aperto !== originale) {
        // Il valore non si stampa mai: e' un nome.
        guasti.push(`${r.athleteId}.${campo}: riaperto diverso dall'originale`);
        continue;
      }
      ok++;
    }
  }
  return { ok, guasti };
}

async function main() {
  apriChiave();

  const { righe, conta } = await stato();
  console.log(`righe totali:        ${conta.totale}`);
  console.log(`gia' cifrate:        ${conta.gia}`);
  console.log(`da cifrare:          ${conta.daFare}`);
  console.log(`parzialmente:        ${conta.miste}\n`);

  if (soloVerifica) {
    console.log('modalita\' --verifica: controllo che ogni riga cifrata si riapra.\n');
    let aperte = 0;
    const guasti: string[] = [];
    for (const r of righe) {
      for (const campo of CAMPI) {
        const v = r[campo];
        if (!eCifrato(v)) continue;
        try {
          decifra(v, r.athleteId);
          aperte++;
        } catch (e) {
          guasti.push(`${r.athleteId}.${campo}: ${(e as Error).message}`);
        }
      }
    }
    console.log(`campi cifrati che si riaprono: ${aperte}`);
    if (guasti.length) {
      console.error(`\nNON SI RIAPRONO (${guasti.length}):`);
      for (const g of guasti) console.error('  ' + g);
      process.exitCode = 1;
    } else {
      console.log('nessun problema.');
    }
    return;
  }

  // ── preparazione in memoria, con round-trip su ogni singolo valore ──────
  const lavoro: { athleteId: string; dati: Partial<Record<Campo, string>>; originali: Partial<Record<Campo, string>> }[] = [];

  for (const r of righe) {
    const dati: Partial<Record<Campo, string>> = {};
    const originali: Partial<Record<Campo, string>> = {};
    for (const campo of CAMPI) {
      const v = r[campo];
      if (typeof v !== 'string' || v === '' || eCifrato(v)) continue;

      const cifrato = cifra(v, r.athleteId);

      // La rete di sicurezza: si riapre subito quello che si sta per scrivere.
      // Se qui qualcosa non torna, non e' ancora stato scritto niente.
      const riaperto = decifra(cifrato, r.athleteId);
      if (riaperto !== v) {
        throw new Error(
          `round-trip fallito su ${r.athleteId}.${campo} — nessuna scrittura effettuata`,
        );
      }

      dati[campo] = cifrato;
      originali[campo] = v;
    }
    if (Object.keys(dati).length > 0) lavoro.push({ athleteId: r.athleteId, dati, originali });
  }

  const campiDaScrivere = lavoro.reduce((n, l) => n + Object.keys(l.dati).length, 0);
  console.log(`righe da aggiornare: ${lavoro.length}`);
  console.log(`campi da cifrare:    ${campiDaScrivere}`);
  console.log('round-trip in memoria: superato su tutti i valori.\n');

  if (lavoro.length === 0) {
    console.log('niente da fare.');
    return;
  }

  if (!esegui) {
    console.log('PROVA A VUOTO — nessuna scrittura. Rilanciare con --esegui per procedere.');
    return;
  }

  // ── scrittura, in transazione ──────────────────────────────────────────
  await prisma.$transaction(
    lavoro.map((l) =>
      prisma.athleteIdentity.update({ where: { athleteId: l.athleteId }, data: l.dati }),
    ),
  );
  console.log(`scritte ${lavoro.length} righe.\n`);

  // ── verifica sui byte davvero salvati ──────────────────────────────────
  const attesi = new Map(lavoro.map((l) => [l.athleteId, l.originali]));
  const { ok, guasti } = await verificaSuDisco(attesi);
  console.log(`verifica su disco: ${ok} campi riletti e riaperti identici all'originale.`);

  if (guasti.length) {
    console.error(`\nPROBLEMI (${guasti.length}):`);
    for (const g of guasti) console.error('  ' + g);
    console.error('\nI dati sono stati scritti ma la verifica non passa. NON cancellare');
    console.error('il backup e non proseguire: vedi PIANO_CIFRATURA_VAULT.md §8.');
    process.exitCode = 1;
    return;
  }

  const dopo = await stato();
  console.log(`\nstato finale — totale ${dopo.conta.totale}, cifrate ${dopo.conta.gia}, ` +
    `in chiaro ${dopo.conta.daFare}, parziali ${dopo.conta.miste}`);
  console.log('Fase 2 completata.');
}

main()
  .catch((e) => {
    console.error('\nERRORE:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
