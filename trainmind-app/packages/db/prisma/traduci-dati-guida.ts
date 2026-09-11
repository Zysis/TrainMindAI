/**
 * TrainMind — traduce i DATI dimostrativi dell'organizzazione AV.
 *
 * Serve alla guida utente: gli screenshot inglesi e spagnoli mostravano
 * interfaccia tradotta ma contenuti in italiano ("Prima Squadra", "Tiro e
 * finalizzazione", criteri RTP...). Questo script riscrive i testi liberi nei
 * dati — non tocca l'interfaccia, che ha il suo i18n.
 *
 * Traduce in avanti e all'indietro: ogni voce del dizionario e' una terna
 * (it, en, es) e lo script riconosce la lingua di partenza dal testo trovato.
 * Quindi `... it` riporta tutto in italiano.
 *
 * NON tocca: nomi e cognomi degli atleti, "Basket Torino", "PalaLAB21",
 * i codici enum (FORZA, CARDIO, ankle_r...) e la libreria protocolli RTP di
 * sistema, che e' condivisa e andrebbe localizzata nel prodotto.
 *
 * Run: pnpm --filter @trainmind/db exec tsx prisma/traduci-dati-guida.ts en
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_NAME = 'AV';

type Lang = 'it' | 'en' | 'es';
const TARGET = (process.argv[2] || 'it') as Lang;
if (!['it', 'en', 'es'].includes(TARGET)) {
  console.error('Uso: tsx prisma/traduci-dati-guida.ts <it|en|es>');
  process.exit(1);
}

/** Terne (it, en, es). L'ordine non conta: il match e' sul testo piu' lungo. */
const DICT: Array<[string, string, string]> = [
  // --- Squadra ---------------------------------------------
  ['Prima squadra senior — stagione 2026/27', 'Senior first team — 2026/27 season', 'Primer equipo senior — temporada 2026/27'],
  ['Prima Squadra', 'First Team', 'Primer Equipo'],

  // --- Periodizzazioni e piani -----------------------------
  ['Piano Allenamento', 'Training Plan', 'Plan de Entrenamiento'],
  ['Playoff & Transizione', 'Playoffs & Transition', 'Playoffs y Transición'],
  ['Off-Season Estate', 'Off-Season Summer', 'Off-Season Verano'],
  ['Campionato', 'League', 'Liga'],

  // --- Mesocicli -------------------------------------------
  ['Preparazione Generale', 'General Preparation', 'Preparación General'],
  ['Forza & Potenza', 'Strength & Power', 'Fuerza y Potencia'],
  ['Pre-Campionato', 'Pre-League', 'Pre-Liga'],
  ['Andata Fase 1', 'First Half Block 1', 'Primera Vuelta Bloque 1'],
  ['Andata Fase 2', 'First Half Block 2', 'Primera Vuelta Bloque 2'],
  ['Ritorno Fase 1', 'Second Half Block 1', 'Segunda Vuelta Bloque 1'],
  ['Ritorno Fase 2', 'Second Half Block 2', 'Segunda Vuelta Bloque 2'],
  ['Recupero Natale', 'Christmas Recovery', 'Recuperación Navidad'],
  ['Scarico Febbraio', 'February Deload', 'Descarga Febrero'],
  ['Scarico Pre-Playoff', 'Pre-Playoff Deload', 'Descarga Pre-Playoff'],
  ['Scarico Post-Playoff', 'Post-Playoff Deload', 'Descarga Post-Playoff'],
  ['Transizione Attiva', 'Active Transition', 'Transición Activa'],
  ['Recupero Estivo', 'Summer Recovery', 'Recuperación Estival'],
  ['Ricostruzione Base', 'Base Rebuild', 'Reconstrucción de Base'],
  ['Sviluppo Forza Estivo', 'Summer Strength Development', 'Desarrollo de Fuerza Estival'],
  ['Rientro Graduale', 'Gradual Return', 'Reincorporación Gradual'],

  // --- Tipi di seduta --------------------------------------
  ['Forza & Condizionamento', 'Strength & Conditioning', 'Fuerza y Acondicionamiento'],
  ['Tecnica individuale', 'Individual skills', 'Técnica individual'],
  ['Tattica di squadra', 'Team tactics', 'Táctica de equipo'],
  ['Tiro e finalizzazione', 'Shooting & finishing', 'Tiro y finalización'],
  ['Agilità e velocità', 'Agility & speed', 'Agilidad y velocidad'],
  ['Recupero attivo', 'Active recovery', 'Recuperación activa'],
  ['Video analisi + campo', 'Video analysis + court', 'Análisis de vídeo + pista'],

  // --- Note di settimana e seduta --------------------------
  ['Sett.', 'Wk.', 'Sem.'],
  ['(Scarico)', '(Deload)', '(Descarga)'],
  ['Intensità:', 'Intensity:', 'Intensidad:'],
  ['Carico:', 'Load:', 'Carga:'],
  ['Focus:', 'Focus:', 'Enfoque:'],
  ['resistenza', 'endurance', 'resistencia'],
  ['velocità', 'speed', 'velocidad'],
  ['agilità', 'agility', 'agilidad'],
  ['pliometria', 'plyometrics', 'pliometría'],
  ['tattica', 'tactics', 'táctica'],
  ['tecnica', 'technique', 'técnica'],
  ['forza', 'strength', 'fuerza'],
  ['tiro', 'shooting', 'tiro'],

  // --- Esercizi --------------------------------------------
  ['Stacco rumeno', 'Romanian deadlift', 'Peso muerto rumano'],
  ['Panca piana', 'Bench press', 'Press de banca'],
  ['Trazioni alla sbarra', 'Pull-ups', 'Dominadas'],
  ['Military press', 'Military press', 'Press militar'],
  ['Leg press', 'Leg press', 'Prensa de piernas'],
  ['Rematore con bilanciere', 'Barbell row', 'Remo con barra'],
  ['Bulgarian split squat', 'Bulgarian split squat', 'Sentadilla búlgara'],
  ['Corsa continua', 'Steady-state run', 'Carrera continua'],
  ['Interval training 30/30', 'Interval training 30/30', 'Entrenamiento interválico 30/30'],
  ['Suicide drill', 'Suicide drill', 'Ejercicio de suicidios'],
  ['Box jump', 'Box jump', 'Salto al cajón'],
  ['Depth jump', 'Depth jump', 'Salto en profundidad'],
  ['Salto in lungo da fermo', 'Standing broad jump', 'Salto de longitud sin impulso'],
  ['Tuck jump', 'Tuck jump', 'Salto agrupado'],
  ['Stretching dinamico', 'Dynamic stretching', 'Estiramiento dinámico'],
  ['Mobilità anche', 'Hip mobility', 'Movilidad de cadera'],
  ['Mobilità spalle', 'Shoulder mobility', 'Movilidad de hombros'],
  ['Tiro da 3 punti', 'Three-point shot', 'Tiro de tres puntos'],
  ['Palleggio in velocità', 'Speed dribbling', 'Bote en velocidad'],
  ['Passaggio a due mani', 'Two-handed pass', 'Pase a dos manos'],
  ['Lay-up destro e sinistro', 'Right and left lay-up', 'Bandeja derecha e izquierda'],
  ['Difesa 1vs1', '1v1 defence', 'Defensa 1c1'],
  ['Tiri liberi', 'Free throws', 'Tiros libres'],
  ['Transizione veloce 3vs2', 'Fast break 3v2', 'Contraataque 3c2'],
  ['Squat', 'Squat', 'Sentadilla'],

  // --- Gruppi muscolari e attrezzatura ---------------------
  ['quadricipiti', 'quadriceps', 'cuádriceps'],
  ['glutei', 'glutes', 'glúteos'],
  ['femorali', 'hamstrings', 'isquiotibiales'],
  ['lombari', 'lower back', 'lumbares'],
  ['petto', 'chest', 'pecho'],
  ['tricipiti', 'triceps', 'tríceps'],
  ['deltoidi', 'delts', 'deltoides'],
  ['dorsali', 'lats', 'dorsales'],
  ['bicipiti', 'biceps', 'bíceps'],
  ['trapezio', 'traps', 'trapecio'],
  ['polpacci', 'calves', 'gemelos'],
  ['cardiovascolare', 'cardiovascular', 'cardiovascular'],
  ['tutto il corpo', 'full body', 'cuerpo entero'],
  ['flessori anca', 'hip flexors', 'flexores de cadera'],
  ['cuffia rotatori', 'rotator cuff', 'manguito rotador'],
  ['bilanciere', 'barbell', 'barra'],
  ['banda elastica', 'resistance band', 'banda elástica'],
  ['manubri', 'dumbbells', 'mancuernas'],
  ['pallone', 'ball', 'balón'],
  ['panca', 'bench', 'banco'],
  ['sbarra', 'pull-up bar', 'barra fija'],

  // --- Infortuni e RTP -------------------------------------
  ['Distorsione in ricaduta da rimbalzo durante partita. Trattamento conservativo, tutore per 10 giorni.',
   'Sprain on landing from a rebound during a game. Conservative treatment, brace for 10 days.',
   'Esguince al caer de un rebote durante el partido. Tratamiento conservador, tobillera durante 10 días.'],
  ['Lesione di I-II grado in sprint di transizione. Ecografia a 5gg, ripresa graduale con protocollo RTP completo.',
   'Grade I-II strain during a transition sprint. Ultrasound at 5 days, gradual return with a full RTP protocol.',
   'Lesión de grado I-II en un sprint de transición. Ecografía a los 5 días, reanudación gradual con protocolo RTP completo.'],
  ["Jumper's knee da sovraccarico di fine stagione. Gestione del carico + rinforzo eccentrico in corso.",
   "Jumper's knee from end-of-season overload. Load management + eccentric strengthening in progress.",
   "Rodilla de saltador por sobrecarga de fin de temporada. Gestión de la carga + refuerzo excéntrico en curso."],
  ['Protocollo RTP —', 'RTP protocol —', 'Protocolo RTP —'],
  ['Dolore a riposo assente', 'No pain at rest', 'Sin dolor en reposo'],
  ['ROM completo senza dolore', 'Full pain-free ROM', 'ROM completo sin dolor'],
  ['Camminata/corsa leggera senza dolore', 'Pain-free walking/light jogging', 'Marcha/carrera suave sin dolor'],
  ['Forza >70% arto controlaterale', 'Strength >70% of contralateral limb', 'Fuerza >70% del miembro contralateral'],
  ['Corsa progressiva e cambi di direzione senza dolore', 'Progressive running and change of direction without pain', 'Carrera progresiva y cambios de dirección sin dolor'],
  ['Forza >85% arto controlaterale', 'Strength >85% of contralateral limb', 'Fuerza >85% del miembro contralateral'],
  ['Allenamento completo senza contatto tollerato', 'Full non-contact training tolerated', 'Entrenamiento completo sin contacto tolerado'],
  ['Test funzionali >90%', 'Functional tests >90%', 'Pruebas funcionales >90%'],
  ['Allenamento completo con contatto tollerato', 'Full contact training tolerated', 'Entrenamiento completo con contacto tolerado'],
  ['Idoneità medica al rientro in gara', 'Medical clearance to return to competition', 'Aptitud médica para volver a competir'],

  // --- Wellness: note delle giornate storte ----------------
  ['Notte insonne', 'Sleepless night', 'Noche sin dormir'],
  ['Mal di testa', 'Headache', 'Dolor de cabeza'],
  ['Poco appetito', 'Poor appetite', 'Poco apetito'],
  ['Stanco mentalmente', 'Mentally tired', 'Cansancio mental'],
  ['Dolore muscolare', 'Muscle soreness', 'Dolor muscular'],
  ['Raffreddore', 'Cold', 'Resfriado'],
  ['Mal di schiena', 'Back pain', 'Dolor de espalda'],
  ['Ansia pre-partita', 'Pre-game anxiety', 'Ansiedad pre-partido'],

  // --- Calendario ------------------------------------------
  ['Amichevole vs', 'Friendly vs', 'Amistoso vs'],
];

const IDX: Record<Lang, number> = { it: 0, en: 1, es: 2 };

/** Frasi da cercare, dalla piu' lunga: cosi "Transizione veloce 3vs2" vince su "Transizione". */
const ENTRIES = DICT.flatMap((triple) =>
  triple.map((variant, from) => ({ variant, triple, from })),
)
  .filter((e) => e.variant.length > 0)
  .sort((a, b) => b.variant.length - a.variant.length);

/**
 * Sostituisce le frasi note. Ogni pezzo tradotto diventa un segnaposto
 * " n ": senza, una parola appena tradotta verrebbe ripescata da una
 * voce piu' corta del dizionario e tradotta due volte.
 */
function tr(text: string | null): string | null {
  if (!text) return text;
  let out = text;
  const slots: string[] = [];
  for (const e of ENTRIES) {
    const target = e.triple[IDX[TARGET]];
    if (e.variant === target) continue;
    let at = out.indexOf(e.variant);
    while (at !== -1) {
      const token = ` ${slots.length} `;
      slots.push(target);
      out = out.slice(0, at) + token + out.slice(at + e.variant.length);
      at = out.indexOf(e.variant);
    }
  }
  return out.replace(/ (\d+) /g, (_, i) => slots[Number(i)]);
}

/** "Criteri fase 2 soddisfatti — avanzamento" e le sue traduzioni. */
function trPhaseReason(text: string | null): string | null {
  if (!text) return text;
  const m =
    text.match(/^Criteri fase (\d) soddisfatti — avanzamento$/) ||
    text.match(/^Phase (\d) criteria met — advancement$/) ||
    text.match(/^Criterios fase (\d) cumplidos — avance$/);
  if (!m) return tr(text);
  const n = m[1];
  return TARGET === 'en'
    ? `Phase ${n} criteria met — advancement`
    : TARGET === 'es'
      ? `Criterios fase ${n} cumplidos — avance`
      : `Criteri fase ${n} soddisfatti — avanzamento`;
}

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: ORG_NAME } });
  if (!org) throw new Error(`Organizzazione ${ORG_NAME} non trovata`);
  const orgId = org.id;
  let n = 0;

  for (const t of await prisma.team.findMany({ where: { organizationId: orgId } })) {
    await prisma.team.update({
      where: { id: t.id },
      data: { name: tr(t.name)!, description: tr(t.description) },
    });
    n++;
  }

  for (const p of await prisma.periodizationPlan.findMany({ where: { organizationId: orgId } })) {
    await prisma.periodizationPlan.update({ where: { id: p.id }, data: { name: tr(p.name)! } });
    n++;
  }

  for (const p of await prisma.trainingPlan.findMany({ where: { organizationId: orgId } })) {
    await prisma.trainingPlan.update({ where: { id: p.id }, data: { name: tr(p.name)! } });
    n++;
  }

  for (const m of await prisma.mesocycle.findMany({
    where: { periodizationPlan: { organizationId: orgId } },
  })) {
    await prisma.mesocycle.update({
      where: { id: m.id },
      data: { name: tr(m.name)!, description: tr(m.description) },
    });
    n++;
  }

  for (const mc of await prisma.microcycle.findMany({
    where: { mesocycle: { periodizationPlan: { organizationId: orgId } } },
  })) {
    const focus = (mc.focusAreas as string[] | null) ?? [];
    if (focus.length > 0) {
      await prisma.microcycle.update({
        where: { id: mc.id },
        data: { focusAreas: focus.map((f) => tr(f)!) },
      });
      n++;
    }
  }

  for (const w of await prisma.week.findMany({ where: { trainingPlan: { organizationId: orgId } } })) {
    await prisma.week.update({ where: { id: w.id }, data: { notes: tr(w.notes) } });
    n++;
  }

  for (const s of await prisma.trainingSession.findMany({ where: { organizationId: orgId } })) {
    await prisma.trainingSession.update({
      where: { id: s.id },
      data: { title: tr(s.title)!, notes: tr(s.notes) },
    });
    n++;
  }

  for (const e of await prisma.exercise.findMany({ where: { organizationId: orgId } })) {
    await prisma.exercise.update({
      where: { id: e.id },
      data: {
        name: tr(e.name)!,
        description: tr(e.description),
        muscleGroups: (e.muscleGroups as string[]).map((g) => tr(g)!),
        equipment: (e.equipment as string[]).map((g) => tr(g)!),
      },
    });
    n++;
  }

  for (const i of await prisma.injury.findMany({ where: { athlete: { organizationId: orgId } } })) {
    await prisma.injury.update({ where: { id: i.id }, data: { notes: tr(i.notes) } });
    n++;
  }

  for (const p of await prisma.rTPProtocol.findMany({ where: { athlete: { organizationId: orgId } } })) {
    await prisma.rTPProtocol.update({ where: { id: p.id }, data: { notes: tr(p.notes) } });
    n++;
  }

  for (const l of await prisma.rTPPhaseLog.findMany({
    where: { rtpProtocol: { athlete: { organizationId: orgId } } },
  })) {
    await prisma.rTPPhaseLog.update({ where: { id: l.id }, data: { reason: trPhaseReason(l.reason) } });
    n++;
  }

  for (const c of await prisma.clearanceCriteria.findMany({
    where: { rtpProtocol: { athlete: { organizationId: orgId } } },
  })) {
    await prisma.clearanceCriteria.update({
      where: { id: c.id },
      data: { description: tr(c.description)! },
    });
    n++;
  }

  for (const w of await prisma.wellnessLog.findMany({
    where: { athlete: { organizationId: orgId }, notes: { not: null } },
  })) {
    await prisma.wellnessLog.update({ where: { id: w.id }, data: { notes: tr(w.notes) } });
    n++;
  }

  for (const ev of await prisma.calendarEvent.findMany({ where: { organizationId: orgId } })) {
    await prisma.calendarEvent.update({
      where: { id: ev.id },
      data: { title: tr(ev.title)!, description: tr(ev.description) },
    });
    n++;
  }

  // Fogli presenze: i nomi degli esercizi vivono dentro una colonna JSON.
  for (const f of await prisma.fieldTrainingSession.findMany({ where: { organizationId: orgId } })) {
    const list = (f.exercises as Array<Record<string, unknown>> | null) ?? [];
    if (list.length > 0) {
      await prisma.fieldTrainingSession.update({
        where: { id: f.id },
        data: {
          exercises: list.map((x) => (typeof x.name === 'string' ? { ...x, name: tr(x.name) } : x)),
          notes: tr(f.notes),
        },
      });
      n++;
    }
  }

  console.log(`Tradotti in "${TARGET}": ${n} record aggiornati.`);
  console.log('Non toccati: nomi degli atleti, libreria protocolli RTP di sistema, codici enum.');
}

main()
  .catch((e) => {
    console.error('Traduzione fallita:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
