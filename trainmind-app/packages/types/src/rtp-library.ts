/**
 * Libreria dei protocolli RTP di sistema.
 *
 * Sono i template precaricati: il medico li vede in sola lettura e puo'
 * duplicarli per farne una versione dell'organizzazione. Il matching (zona >
 * macro-regione > generico) sta in `pickRtpTemplate` di @trainmind/utils.
 *
 * I contenuti sono criteri di consenso della letteratura sul ritorno allo
 * sport, adattati alla pallacanestro. Non sono un protocollo medico: sono un
 * punto di partenza ragionevole che il medico della squadra deve rivedere.
 *
 * Due avvertenze che valgono per tutta la libreria:
 *
 * - **L'LSI (limb symmetry index) sovrastima la funzione** quando anche l'arto
 *   sano si e' decondizionato durante lo stop. Dove esiste un dato
 *   pre-infortunio, il confronto giusto e' quello, non il controlaterale.
 * - **I giorni sono indicativi**, servono a stimare una data di rientro. A
 *   decidere sono i criteri, non il calendario.
 *
 * Questo file e' la fonte unica: il seed SQL della migration viene generato da
 * qui con `scripts/gen-rtp-seed.mjs`, cosi' le due copie non divergono.
 */

import type { RtpTemplate, RtpTemplateCriterion, RtpTemplatePhase, RtpComparator } from './index';

interface CriterionSpec {
  d: string;
  test?: string;
  cmp?: RtpComparator;
  target?: number;
  unit?: string;
  /** true = raccomandazione, non blocca il passaggio di fase. */
  opt?: boolean;
}

function crit(spec: CriterionSpec, order: number): RtpTemplateCriterion {
  return {
    order,
    description: spec.d,
    testCode: spec.test ?? null,
    comparator: spec.cmp ?? null,
    targetValue: spec.target ?? null,
    unit: spec.unit ?? null,
    mandatory: !spec.opt,
  };
}

function phase(
  order: number,
  name: string,
  goal: string,
  minDays: number,
  typicalDays: number,
  specs: CriterionSpec[],
): RtpTemplatePhase {
  return { order, name, goal, minDays, typicalDays, criteria: specs.map((s, i) => crit(s, i + 1)) };
}

// ─── Ginocchio ───────────────────────────────────────────

const KNEE_LIGAMENT_MAJOR: RtpTemplate = {
  code: 'knee_ligament_major',
  name: 'Ginocchio — lesione legamentosa maggiore (LCA/LCM di grado elevato)',
  description:
    'Sei fasi su circa otto mesi. La forza del quadricipite e la batteria di hop test sono i due cancelli che contano; ' +
    'l\'ACL-RSI misura la disponibilita\' psicologica, che e\' un predittore di re-infortunio quanto la forza.',
  bodyZone: 'knee',
  injuryType: 'ligament',
  severityMin: 3,
  severityMax: 5,
  isSystem: true,
  phases: [
    phase(1, 'Protezione e controllo dell\'effusione', 'Spegnere infiammazione e dolore, riprendere l\'estensione completa', 7, 14, [
      { d: 'Dolore a riposo entro 2/10', test: 'VAS a riposo', cmp: 'lte', target: 2, unit: '/10' },
      { d: 'Versamento assente o minimo (stroke test 0/1+)' },
      { d: 'Estensione passiva completa, simmetrica al controlaterale', test: 'Deficit di estensione', cmp: 'lte', target: 0, unit: 'gradi' },
      { d: 'Contrazione volontaria del quadricipite senza extension lag' },
      { d: 'Cammino senza stampelle e senza zoppia' },
    ]),
    phase(2, 'Recupero del ROM e della forza di base', 'Flessione completa, quadricipite oltre il 70%, nessuna reazione al carico', 30, 42, [
      { d: 'Flessione attiva almeno 125 gradi', test: 'Flessione attiva', cmp: 'gte', target: 125, unit: 'gradi' },
      { d: 'Nessun versamento nelle 24 h dopo la seduta di carico' },
      { d: 'Forza isometrica del quadricipite almeno 70% del controlaterale', test: 'Quadricipite LSI', cmp: 'gte', target: 70, unit: '%' },
      { d: 'Salita e discesa delle scale senza dolore' },
      { d: 'Bici ed ellittica 20 minuti senza sintomi', opt: true },
    ]),
    phase(3, 'Forza e ritorno alla corsa', 'Corsa lineare tollerata, quadricipite oltre l\'80%', 45, 60, [
      { d: 'Forza del quadricipite almeno 80% del controlaterale', test: 'Quadricipite LSI', cmp: 'gte', target: 80, unit: '%' },
      { d: 'Rapporto ischiocrurali/quadricipite almeno 0.55', test: 'H/Q ratio', cmp: 'gte', target: 0.55, unit: 'rapporto' },
      { d: 'Corsa lineare 20 minuti senza dolore ne\' versamento' },
      { d: 'Single leg hop test almeno 80% del controlaterale', test: 'Single hop LSI', cmp: 'gte', target: 80, unit: '%' },
      { d: 'Y-Balance anteriore: differenza tra i due arti sotto i 4 cm', test: 'Y-Balance ANT', cmp: 'lte', target: 4, unit: 'cm', opt: true },
    ]),
    phase(4, 'Sport-specifico senza contatto', 'Cambi di direzione e gesto tecnico completo, batteria hop oltre il 90%', 45, 60, [
      { d: 'Forza del quadricipite almeno 90% del controlaterale', test: 'Quadricipite LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Batteria hop test (singolo, triplo, crossover, 6 m a tempo) tutti almeno 90%', test: 'Hop battery LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Cambi di direzione e decelerazioni a intensita\' progressiva senza dolore' },
      { d: 'Drill di tiro, palleggio e scivolamenti difensivi completati al 100%' },
      { d: 'Nessun versamento nelle 24 h successive alle sedute intense' },
    ]),
    phase(5, 'Allenamento completo con la squadra', 'Contatto, carico pieno e disponibilita\' psicologica', 30, 45, [
      { d: 'Almeno 4 allenamenti completi con contatto senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 4, unit: 'sedute' },
      { d: 'Forza del quadricipite almeno 95% del controlaterale', test: 'Quadricipite LSI', cmp: 'gte', target: 95, unit: '%' },
      { d: 'ACL-RSI almeno 65', test: 'ACL-RSI', cmp: 'gte', target: 65, unit: 'punti' },
      { d: 'Carico settimanale (sRPE) allineato ai compagni di ruolo, ACWR fra 0.8 e 1.3', opt: true },
    ]),
    phase(6, 'Ritorno alla partita', 'Rientro graduale in gara con minutaggio concordato', 21, 30, [
      { d: 'Clearance medica firmata' },
      { d: 'Nessun episodio di cedimento (giving way) negli ultimi 30 giorni' },
      { d: 'ACL-RSI almeno 76', test: 'ACL-RSI', cmp: 'gte', target: 76, unit: 'punti' },
      { d: 'Minutaggio progressivo concordato per le prime tre partite', opt: true },
    ]),
  ],
};

const KNEE_LIGAMENT_MINOR: RtpTemplate = {
  code: 'knee_ligament_minor',
  name: 'Ginocchio — distorsione legamentosa lieve',
  description: 'Quattro fasi su circa un mese: LCM di grado I-II e distorsioni senza instabilita\'.',
  bodyZone: 'knee',
  injuryType: 'ligament',
  severityMin: 1,
  severityMax: 2,
  isSystem: true,
  phases: [
    phase(1, 'Controllo del dolore', 'Carico completo senza zoppia', 2, 5, [
      { d: 'Dolore a riposo entro 2/10', test: 'VAS a riposo', cmp: 'lte', target: 2, unit: '/10' },
      { d: 'Versamento assente o minimo' },
      { d: 'Carico completo senza zoppia' },
    ]),
    phase(2, 'ROM e forza', 'ROM completo, quadricipite oltre l\'80%', 5, 10, [
      { d: 'ROM attivo completo e simmetrico' },
      { d: 'Forza isometrica del quadricipite almeno 80% del controlaterale', test: 'Quadricipite LSI', cmp: 'gte', target: 80, unit: '%' },
      { d: 'Corsa lineare senza dolore' },
    ]),
    phase(3, 'Sport-specifico', 'Cambi di direzione e salti senza sintomi', 5, 10, [
      { d: 'Single leg hop test almeno 90%', test: 'Single hop LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Cambi di direzione a intensita\' piena senza dolore' },
      { d: 'Drill di tiro e difesa completati' },
    ]),
    phase(4, 'Rientro', 'Allenamento completo e gara', 3, 7, [
      { d: 'Due allenamenti completi con contatto senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Nessun gonfiore post-allenamento' },
      { d: 'Clearance medica' },
    ]),
  ],
};

const KNEE_TENDON: RtpTemplate = {
  code: 'knee_tendon',
  name: 'Ginocchio — tendinopatia rotulea',
  description:
    'Il dolore non deve sparire prima di caricare: si progredisce mantenendo il dolore entro 3/10 durante ' +
    'l\'esercizio e senza peggioramento il mattino dopo. Il VISA-P e\' il punteggio di riferimento.',
  bodyZone: 'knee',
  injuryType: 'tendon',
  isSystem: true,
  phases: [
    phase(1, 'Isometrie e riduzione del carico irritativo', 'Abbassare il dolore senza fermare il tendine', 7, 14, [
      { d: 'Dolore durante il single leg decline squat entro 3/10', test: 'Decline squat VAS', cmp: 'lte', target: 3, unit: '/10' },
      { d: 'Nessun peggioramento del dolore il mattino successivo' },
      { d: 'Tolleranza a 5 isometrie da 45 secondi', test: 'Isometrie', cmp: 'gte', target: 5, unit: 'serie' },
      { d: 'Salti e pliometria sospesi in questa fase' },
    ]),
    phase(2, 'Forza lenta e pesante', 'Costruire capacita\' di carico del tendine', 21, 28, [
      { d: 'Progressione di forza lenta e pesante tollerata (3 sedute a settimana)', test: 'Sedute forza', cmp: 'gte', target: 3, unit: 'sedute/sett' },
      { d: 'Forza del quadricipite almeno 80% del controlaterale', test: 'Quadricipite LSI', cmp: 'gte', target: 80, unit: '%' },
      { d: 'VISA-P almeno 70', test: 'VISA-P', cmp: 'gte', target: 70, unit: 'punti' },
      { d: 'Dolore durante l\'esercizio stabilmente entro 3/10', test: 'VAS durante esercizio', cmp: 'lte', target: 3, unit: '/10' },
    ]),
    phase(3, 'Energy storage: pliometria progressiva', 'Reintrodurre salto e atterraggio', 14, 21, [
      { d: 'Salti bipodalici e monopodalici senza aumento del dolore' },
      { d: 'Atterraggio controllato, senza valgo dinamico' },
      { d: 'VISA-P almeno 80', test: 'VISA-P', cmp: 'gte', target: 80, unit: 'punti' },
      { d: 'Countermovement jump almeno 90% del controlaterale', test: 'CMJ LSI', cmp: 'gte', target: 90, unit: '%', opt: true },
    ]),
    phase(4, 'Sport-specifico', 'Volume di salti da allenamento', 10, 14, [
      { d: 'Allenamento di tiro e rimbalzo a volume pieno senza reazione' },
      { d: 'Nessun peggioramento mattutino dopo le sedute con salti' },
      { d: 'Forza del quadricipite almeno 90%', test: 'Quadricipite LSI', cmp: 'gte', target: 90, unit: '%' },
    ]),
    phase(5, 'Rientro e gestione del carico', 'Gara con monitoraggio del volume di salti', 7, 14, [
      { d: 'Due allenamenti completi con la squadra senza reazione' },
      { d: 'VISA-P almeno 85', test: 'VISA-P', cmp: 'gte', target: 85, unit: 'punti' },
      { d: 'Piano di gestione del carico concordato per le settimane successive', opt: true },
    ]),
  ],
};

const KNEE_GENERIC: RtpTemplate = {
  code: 'knee_generic',
  name: 'Ginocchio — protocollo generico',
  description: 'Fallback di zona: meniscopatie, contusioni articolari e quadri non coperti dai protocolli specifici.',
  bodyZone: 'knee',
  isSystem: true,
  phases: [
    phase(1, 'Protezione', 'Dolore e versamento sotto controllo', 5, 10, [
      { d: 'Dolore a riposo entro 2/10', test: 'VAS a riposo', cmp: 'lte', target: 2, unit: '/10' },
      { d: 'Versamento assente o minimo' },
      { d: 'Estensione completa' },
    ]),
    phase(2, 'ROM e forza', 'Flessione completa e quadricipite oltre il 75%', 14, 21, [
      { d: 'Flessione attiva almeno 125 gradi', test: 'Flessione attiva', cmp: 'gte', target: 125, unit: 'gradi' },
      { d: 'Forza del quadricipite almeno 75% del controlaterale', test: 'Quadricipite LSI', cmp: 'gte', target: 75, unit: '%' },
      { d: 'Nessun versamento dopo il carico' },
    ]),
    phase(3, 'Corsa e agilita\'', 'Corsa e cambi di direzione senza sintomi', 14, 21, [
      { d: 'Corsa lineare 20 minuti senza dolore' },
      { d: 'Single leg hop test almeno 85%', test: 'Single hop LSI', cmp: 'gte', target: 85, unit: '%' },
      { d: 'Cambi di direzione progressivi senza dolore' },
    ]),
    phase(4, 'Sport-specifico', 'Drill di squadra senza contatto', 10, 14, [
      { d: 'Forza del quadricipite almeno 90%', test: 'Quadricipite LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Drill tecnici completati al 100% di intensita\'' },
      { d: 'Nessun versamento nelle 24 h successive' },
    ]),
    phase(5, 'Rientro', 'Allenamento completo e gara', 7, 10, [
      { d: 'Due allenamenti completi con contatto senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Clearance medica' },
    ]),
  ],
};

// ─── Caviglia e piede ────────────────────────────────────

const ANKLE_LIGAMENT_MAJOR: RtpTemplate = {
  code: 'ankle_ligament_major',
  name: 'Caviglia — distorsione di grado elevato',
  description:
    'La distorsione di caviglia e\' l\'infortunio piu\' frequente e quello con la recidiva piu\' alta, quasi sempre ' +
    'per un rientro deciso sul dolore invece che sul controllo. Equilibrio monopodalico e CAIT sono i criteri che ' +
    'discriminano davvero.',
  bodyZone: 'ankle',
  injuryType: 'ligament',
  severityMin: 3,
  severityMax: 5,
  isSystem: true,
  phases: [
    phase(1, 'Protezione e carico', 'Carico completo senza zoppia', 3, 7, [
      { d: 'Dolore a riposo entro 2/10', test: 'VAS a riposo', cmp: 'lte', target: 2, unit: '/10' },
      { d: 'Edema in riduzione, differenza di circonferenza sotto 1 cm', test: 'Differenza malleolare', cmp: 'lte', target: 1, unit: 'cm' },
      { d: 'Carico completo senza stampelle e senza zoppia' },
    ]),
    phase(2, 'ROM, forza e propriocezione', 'Dorsiflessione simmetrica e appoggio monopodalico stabile', 10, 14, [
      { d: 'Weight bearing lunge test: differenza sotto 2 cm', test: 'WBLT differenza', cmp: 'lte', target: 2, unit: 'cm' },
      { d: 'Forza degli eversori almeno 80% del controlaterale', test: 'Eversori LSI', cmp: 'gte', target: 80, unit: '%' },
      { d: 'Appoggio monopodalico a occhi chiusi 30 secondi', test: 'Equilibrio occhi chiusi', cmp: 'gte', target: 30, unit: 'secondi' },
      { d: 'Salita sulle punte monopodalica: 20 ripetizioni', test: 'Heel raise', cmp: 'gte', target: 20, unit: 'ripetizioni' },
    ]),
    phase(3, 'Corsa e salti', 'Corsa, salto e atterraggio senza dolore', 10, 14, [
      { d: 'Corsa lineare 20 minuti senza dolore' },
      { d: 'Y-Balance arto inferiore: differenza sotto 4 cm', test: 'Y-Balance ANT', cmp: 'lte', target: 4, unit: 'cm' },
      { d: 'Single leg hop test almeno 90%', test: 'Single hop LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Atterraggio monopodalico controllato' },
    ]),
    phase(4, 'Sport-specifico', 'Cambi di direzione e gesto tecnico completo', 7, 12, [
      { d: 'Cambi di direzione, arresti e scivolamenti a intensita\' piena' },
      { d: 'CAIT almeno 24', test: 'CAIT', cmp: 'gte', target: 24, unit: 'punti' },
      { d: 'Drill di rimbalzo e contrasto senza apprensione' },
      { d: 'Taping o cavigliera concordati per il rientro', opt: true },
    ]),
    phase(5, 'Rientro', 'Allenamento completo e gara', 5, 10, [
      { d: 'Due allenamenti completi con contatto senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Nessun gonfiore serale dopo l\'allenamento' },
      { d: 'Clearance medica' },
    ]),
  ],
};

const ANKLE_LIGAMENT_MINOR: RtpTemplate = {
  code: 'ankle_ligament_minor',
  name: 'Caviglia — distorsione lieve',
  description: 'Quattro fasi su circa due settimane. Il criterio da non saltare resta l\'equilibrio monopodalico.',
  bodyZone: 'ankle',
  injuryType: 'ligament',
  severityMin: 1,
  severityMax: 2,
  isSystem: true,
  phases: [
    phase(1, 'Controllo del dolore', 'Carico completo', 1, 3, [
      { d: 'Dolore a riposo entro 2/10', test: 'VAS a riposo', cmp: 'lte', target: 2, unit: '/10' },
      { d: 'Carico completo senza zoppia' },
    ]),
    phase(2, 'ROM e propriocezione', 'Dorsiflessione simmetrica, equilibrio recuperato', 3, 5, [
      { d: 'Weight bearing lunge test: differenza sotto 2 cm', test: 'WBLT differenza', cmp: 'lte', target: 2, unit: 'cm' },
      { d: 'Appoggio monopodalico a occhi chiusi 30 secondi', test: 'Equilibrio occhi chiusi', cmp: 'gte', target: 30, unit: 'secondi' },
    ]),
    phase(3, 'Corsa e salti', 'Salto e cambio di direzione senza dolore', 3, 5, [
      { d: 'Single leg hop test almeno 90%', test: 'Single hop LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Cambi di direzione a intensita\' piena senza dolore' },
    ]),
    phase(4, 'Rientro', 'Allenamento completo e gara', 2, 4, [
      { d: 'Un allenamento completo senza sintomi' },
      { d: 'CAIT almeno 24', test: 'CAIT', cmp: 'gte', target: 24, unit: 'punti', opt: true },
    ]),
  ],
};

const ANKLE_GENERIC: RtpTemplate = {
  code: 'ankle_generic',
  name: 'Caviglia — protocollo generico',
  description: 'Fallback di zona per quadri non legamentosi: contusioni, sovraccarichi, quadri articolari.',
  bodyZone: 'ankle',
  isSystem: true,
  phases: [
    phase(1, 'Protezione', 'Dolore e gonfiore sotto controllo', 3, 7, [
      { d: 'Dolore a riposo entro 2/10', test: 'VAS a riposo', cmp: 'lte', target: 2, unit: '/10' },
      { d: 'Carico completo senza zoppia' },
    ]),
    phase(2, 'ROM e forza', 'Dorsiflessione simmetrica e forza recuperata', 7, 12, [
      { d: 'Weight bearing lunge test: differenza sotto 2 cm', test: 'WBLT differenza', cmp: 'lte', target: 2, unit: 'cm' },
      { d: 'Salita sulle punte monopodalica: 20 ripetizioni', test: 'Heel raise', cmp: 'gte', target: 20, unit: 'ripetizioni' },
    ]),
    phase(3, 'Corsa e salti', 'Corsa e pliometria senza sintomi', 7, 12, [
      { d: 'Corsa lineare 20 minuti senza dolore' },
      { d: 'Single leg hop test almeno 90%', test: 'Single hop LSI', cmp: 'gte', target: 90, unit: '%' },
    ]),
    phase(4, 'Sport-specifico', 'Gesto tecnico completo', 5, 10, [
      { d: 'Cambi di direzione e arresti a intensita\' piena' },
      { d: 'Drill di squadra completati' },
    ]),
    phase(5, 'Rientro', 'Allenamento completo e gara', 5, 7, [
      { d: 'Due allenamenti completi senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Clearance medica' },
    ]),
  ],
};

// ─── Muscoli dell'arto inferiore ─────────────────────────

const HAMSTRING_MUSCULAR: RtpTemplate = {
  code: 'hamstring_muscular',
  name: 'Ischiocrurali — lesione muscolare',
  description:
    'La recidiva si gioca sulla forza a lunghezza estesa e sulla velocita\' massimale: rientrare senza aver ' +
    'sprintato a velocita\' piena e\' il modo classico per rifarsi male. L\'H-test di Askling e\' il criterio ' +
    'che intercetta l\'apprensione residua.',
  bodyZone: 'hamstring',
  injuryType: 'muscular',
  isSystem: true,
  phases: [
    phase(1, 'Protezione', 'Cammino normale, dolore sotto controllo', 3, 5, [
      { d: 'Cammino senza zoppia' },
      { d: 'Dolore alla palpazione in riduzione' },
      { d: 'Contrazione isometrica submassimale indolore' },
    ]),
    phase(2, 'Forza e allungamento controllato', 'Recuperare forza a lunghezza crescente', 7, 12, [
      { d: 'Isometrica a 90/90 senza dolore' },
      { d: 'Forza isometrica almeno 80% del controlaterale', test: 'Isometrica LSI', cmp: 'gte', target: 80, unit: '%' },
      { d: 'Corsa a intensita\' bassa senza dolore' },
      { d: 'Nessun dolore alla palpazione a riposo' },
    ]),
    phase(3, 'Eccentrico e corsa veloce', 'Tolleranza eccentrica e progressione della velocita\'', 10, 14, [
      { d: 'Nordic hamstring exercise tollerato senza dolore' },
      { d: 'Forza eccentrica almeno 90% del controlaterale', test: 'Eccentrica LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Corsa all\'80% della velocita\' massimale senza sintomi', test: 'Velocita\' raggiunta', cmp: 'gte', target: 80, unit: '%' },
    ]),
    phase(4, 'Velocita\' massimale e sport-specifico', 'Sprint pieno e gesto di gara', 7, 12, [
      { d: 'Askling H-test negativo (nessuna apprensione)' },
      { d: 'Sprint alla velocita\' massimale del pre-infortunio', test: 'Velocita\' raggiunta', cmp: 'gte', target: 95, unit: '%' },
      { d: 'Forza isometrica a lunghezza estesa almeno 95%', test: 'Isometrica LSI', cmp: 'gte', target: 95, unit: '%' },
      { d: 'Contropiede, arresti e ripartenze a intensita\' piena' },
    ]),
    phase(5, 'Rientro', 'Allenamento completo e gara', 5, 7, [
      { d: 'Due allenamenti completi senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Nessun dolore alla palpazione dopo l\'allenamento' },
      { d: 'Clearance medica' },
    ]),
  ],
};

const CALF_MUSCULAR: RtpTemplate = {
  code: 'calf_muscular',
  name: 'Polpaccio — lesione muscolare',
  description: 'Il criterio guida e\' la capacita\' di lavoro del tricipite surale: le salite sulle punte monopodaliche.',
  bodyZone: 'calf',
  injuryType: 'muscular',
  isSystem: true,
  phases: [
    phase(1, 'Protezione', 'Cammino normale', 3, 5, [
      { d: 'Cammino senza zoppia' },
      { d: 'Salita bipodalica sulle punte indolore' },
    ]),
    phase(2, 'Forza', 'Capacita\' di lavoro monopodalica', 7, 12, [
      { d: 'Salita monopodalica sulle punte: almeno 15 ripetizioni', test: 'Heel raise', cmp: 'gte', target: 15, unit: 'ripetizioni' },
      { d: 'Corsa a intensita\' bassa senza dolore' },
      { d: 'Nessun dolore alla palpazione a riposo' },
    ]),
    phase(3, 'Pliometria e velocita\'', 'Salto e corsa veloce', 7, 12, [
      { d: 'Salita monopodalica sulle punte: almeno 25 ripetizioni', test: 'Heel raise', cmp: 'gte', target: 25, unit: 'ripetizioni' },
      { d: 'Hop test monopodalico almeno 90%', test: 'Single hop LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Corsa all\'85% della velocita\' massimale senza sintomi', test: 'Velocita\' raggiunta', cmp: 'gte', target: 85, unit: '%' },
    ]),
    phase(4, 'Sport-specifico', 'Gesto di gara completo', 5, 8, [
      { d: 'Sprint, arresti e cambi di direzione a intensita\' piena' },
      { d: 'Volume di salti da allenamento tollerato' },
    ]),
    phase(5, 'Rientro', 'Allenamento completo e gara', 4, 6, [
      { d: 'Due allenamenti completi senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Clearance medica' },
    ]),
  ],
};

const QUADRICEPS_MUSCULAR: RtpTemplate = {
  code: 'quadriceps_muscular',
  name: 'Quadricipite — lesione muscolare',
  description: 'Attenzione al retto femorale: e\' biarticolare e va testato anche in allungamento, con l\'anca estesa.',
  bodyZone: 'quadriceps',
  injuryType: 'muscular',
  isSystem: true,
  phases: [
    phase(1, 'Protezione', 'Cammino normale e contrazione indolore', 3, 5, [
      { d: 'Cammino senza zoppia' },
      { d: 'Contrazione isometrica submassimale indolore' },
      { d: 'Flessione passiva del ginocchio in progressione' },
    ]),
    phase(2, 'Forza', 'Forza concentrica recuperata', 7, 12, [
      { d: 'Forza isometrica almeno 80% del controlaterale', test: 'Quadricipite LSI', cmp: 'gte', target: 80, unit: '%' },
      { d: 'Squat monopodalico controllato senza dolore' },
      { d: 'Corsa a intensita\' bassa senza dolore' },
    ]),
    phase(3, 'Eccentrico e pliometria', 'Tolleranza al carico eccentrico e al salto', 7, 14, [
      { d: 'Forza almeno 90% del controlaterale', test: 'Quadricipite LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Test di allungamento (Ely) senza dolore' },
      { d: 'Salti e atterraggi controllati senza sintomi' },
    ]),
    phase(4, 'Sport-specifico', 'Sprint e cambi di direzione a intensita\' piena', 5, 10, [
      { d: 'Sprint a intensita\' piena senza dolore' },
      { d: 'Drill tecnici e difensivi completati' },
    ]),
    phase(5, 'Rientro', 'Allenamento completo e gara', 4, 6, [
      { d: 'Due allenamenti completi senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Clearance medica' },
    ]),
  ],
};

const GROIN_ANY: RtpTemplate = {
  code: 'groin_any',
  name: 'Adduttori e inguine',
  description:
    'Il test di riferimento e\' lo squeeze test degli adduttori a 45 gradi; il Copenhagen adduction e\' insieme ' +
    'esercizio e criterio di tolleranza.',
  bodyZone: 'groin',
  isSystem: true,
  phases: [
    phase(1, 'Controllo del dolore', 'Cammino e vita quotidiana senza dolore', 3, 7, [
      { d: 'Cammino senza dolore' },
      { d: 'Squeeze test submassimale tollerato' },
    ]),
    phase(2, 'Forza isometrica', 'Recuperare forza degli adduttori', 10, 14, [
      { d: 'Squeeze test a 45 gradi almeno 75% del valore atteso', test: 'Squeeze test', cmp: 'gte', target: 75, unit: '%' },
      { d: 'Corsa lineare senza dolore' },
      { d: 'Nessun dolore inguinale al risveglio' },
    ]),
    phase(3, 'Forza eccentrica e cambi di direzione', 'Copenhagen tollerato, cambi di direzione progressivi', 10, 14, [
      { d: 'Copenhagen adduction tollerato per 3 serie', test: 'Copenhagen', cmp: 'gte', target: 3, unit: 'serie' },
      { d: 'Squeeze test almeno 90%', test: 'Squeeze test', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Cambi di direzione a intensita\' progressiva senza dolore' },
    ]),
    phase(4, 'Sport-specifico', 'Scivolamenti difensivi e gesto di gara', 7, 10, [
      { d: 'Scivolamenti difensivi e arresti a intensita\' piena' },
      { d: 'Nessun dolore nelle 24 h successive alle sedute intense' },
      { d: 'HAGOS sport almeno 80', test: 'HAGOS sport', cmp: 'gte', target: 80, unit: 'punti', opt: true },
    ]),
    phase(5, 'Rientro', 'Allenamento completo e gara', 5, 7, [
      { d: 'Due allenamenti completi senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Clearance medica' },
    ]),
  ],
};

const LOWER_LIMB_MUSCULAR: RtpTemplate = {
  code: 'lower_limb_muscular',
  name: 'Arto inferiore — lesione muscolare (generico)',
  description: 'Fallback di regione per i muscoli senza protocollo dedicato: anca, ileopsoas, piede.',
  bodyRegion: 'lower_limb',
  injuryType: 'muscular',
  isSystem: true,
  phases: [
    phase(1, 'Protezione', 'Cammino normale', 3, 5, [
      { d: 'Cammino senza zoppia' },
      { d: 'Contrazione isometrica submassimale indolore' },
    ]),
    phase(2, 'Forza', 'Forza oltre l\'80% del controlaterale', 7, 12, [
      { d: 'Forza isometrica almeno 80% del controlaterale', test: 'Forza LSI', cmp: 'gte', target: 80, unit: '%' },
      { d: 'Corsa a intensita\' bassa senza dolore' },
    ]),
    phase(3, 'Eccentrico e velocita\'', 'Carico eccentrico e corsa veloce', 7, 12, [
      { d: 'Forza almeno 90% del controlaterale', test: 'Forza LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Corsa all\'85% della velocita\' massimale senza sintomi', test: 'Velocita\' raggiunta', cmp: 'gte', target: 85, unit: '%' },
    ]),
    phase(4, 'Sport-specifico', 'Gesto di gara completo', 5, 10, [
      { d: 'Cambi di direzione, arresti e salti a intensita\' piena' },
      { d: 'Drill di squadra completati' },
    ]),
    phase(5, 'Rientro', 'Allenamento completo e gara', 4, 7, [
      { d: 'Due allenamenti completi senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Clearance medica' },
    ]),
  ],
};

// ─── Arto superiore ──────────────────────────────────────

const SHOULDER_INSTABILITY: RtpTemplate = {
  code: 'shoulder_instability',
  name: 'Spalla — instabilita\' e lesione capsulo-legamentosa',
  description:
    'Qui i criteri non hanno nulla a che vedere con quelli di un arto inferiore: contano il controllo scapolare, ' +
    'il rapporto fra extrarotatori e intrarotatori e la tenuta in catena chiusa (CKCUEST). Il test di apprensione ' +
    'negativo e\' il cancello per il contatto.',
  bodyZone: 'shoulder',
  injuryType: 'ligament',
  isSystem: true,
  phases: [
    phase(1, 'Protezione e ROM protetto', 'Dolore sotto controllo, ROM nei limiti concessi', 10, 21, [
      { d: 'Dolore a riposo entro 2/10', test: 'VAS a riposo', cmp: 'lte', target: 2, unit: '/10' },
      { d: 'ROM passivo entro i limiti indicati dal medico, senza apprensione' },
      { d: 'Controllo scapolare in posizione neutra' },
      { d: 'Nessun deficit neurologico all\'arto' },
    ]),
    phase(2, 'ROM completo e forza di base', 'ROM simmetrico e cuffia oltre il 70%', 21, 30, [
      { d: 'ROM attivo completo e simmetrico al controlaterale' },
      { d: 'Extrarotazione: forza almeno 70% del controlaterale', test: 'Extrarotatori LSI', cmp: 'gte', target: 70, unit: '%' },
      { d: 'Rapporto extrarotatori/intrarotatori almeno 0.65', test: 'ER/IR ratio', cmp: 'gte', target: 0.65, unit: 'rapporto' },
      { d: 'Nessun dolore notturno' },
    ]),
    phase(3, 'Forza e controllo in catena chiusa', 'Tenuta sopra la testa e in appoggio', 21, 30, [
      { d: 'Extrarotazione: forza almeno 85% del controlaterale', test: 'Extrarotatori LSI', cmp: 'gte', target: 85, unit: '%' },
      { d: 'CKCUEST almeno 21 tocchi', test: 'CKCUEST', cmp: 'gte', target: 21, unit: 'tocchi' },
      { d: 'Y-Balance arto superiore: differenza sotto 4 cm', test: 'Y-Balance UQ', cmp: 'lte', target: 4, unit: 'cm', opt: true },
      { d: 'Lavoro sopra la testa senza dolore' },
    ]),
    phase(4, 'Sport-specifico senza contatto', 'Passaggio, tiro e rimbalzo a intensita\' piena', 14, 21, [
      { d: 'Test di apprensione negativo' },
      { d: 'Extrarotazione: forza almeno 90% del controlaterale', test: 'Extrarotatori LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Passaggi e tiri a distanza e intensita\' di gara senza dolore' },
      { d: 'Cadute e appoggi controllati sul tappetino' },
    ]),
    phase(5, 'Contatto e rientro', 'Contrasti, rimbalzi e gara', 10, 14, [
      { d: 'Contrasti e lotta a rimbalzo senza apprensione' },
      { d: 'Due allenamenti completi con contatto senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Clearance medica firmata' },
    ]),
  ],
};

const SHOULDER_TENDON: RtpTemplate = {
  code: 'shoulder_tendon',
  name: 'Spalla — tendinopatia della cuffia',
  description: 'Progressione sul carico tollerato, con il dolore entro 3/10 durante l\'esercizio e nessun peggioramento il giorno dopo.',
  bodyZone: 'shoulder',
  injuryType: 'tendon',
  isSystem: true,
  phases: [
    phase(1, 'Riduzione del carico irritativo', 'Abbassare il dolore, mantenere il movimento', 7, 14, [
      { d: 'Dolore notturno assente' },
      { d: 'Dolore durante l\'esercizio entro 3/10', test: 'VAS durante esercizio', cmp: 'lte', target: 3, unit: '/10' },
      { d: 'ROM attivo mantenuto, lavoro sopra la testa sospeso' },
    ]),
    phase(2, 'Forza isometrica e controllo scapolare', 'Costruire tolleranza al carico', 14, 21, [
      { d: 'Isometrie di extrarotazione tollerate a carico progressivo' },
      { d: 'Controllo scapolare corretto nei movimenti sopra la testa' },
      { d: 'Extrarotazione: forza almeno 80% del controlaterale', test: 'Extrarotatori LSI', cmp: 'gte', target: 80, unit: '%' },
    ]),
    phase(3, 'Forza dinamica e lavoro sopra la testa', 'Riprendere il gesto sopra la testa', 14, 21, [
      { d: 'Extrarotazione: forza almeno 90% del controlaterale', test: 'Extrarotatori LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Rapporto extrarotatori/intrarotatori almeno 0.68', test: 'ER/IR ratio', cmp: 'gte', target: 0.68, unit: 'rapporto' },
      { d: 'CKCUEST almeno 21 tocchi', test: 'CKCUEST', cmp: 'gte', target: 21, unit: 'tocchi', opt: true },
    ]),
    phase(4, 'Sport-specifico', 'Volume di tiro da allenamento', 10, 14, [
      { d: 'Volume di tiro da allenamento senza reazione il giorno dopo' },
      { d: 'Passaggi lunghi a intensita\' piena senza dolore' },
    ]),
    phase(5, 'Rientro e gestione del carico', 'Gara con volume di tiro monitorato', 7, 10, [
      { d: 'Due allenamenti completi senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Piano di gestione del volume di tiro concordato', opt: true },
    ]),
  ],
};

const SHOULDER_GENERIC: RtpTemplate = {
  code: 'shoulder_generic',
  name: 'Spalla — protocollo generico',
  description:
    'Fallback di zona per quadri diversi da instabilita\' e tendinopatia, comprese le lesioni ossee della ' +
    'cintura scapolare: in quel caso il primo criterio della fase 1 e\' la guarigione documentata.',
  bodyZone: 'shoulder',
  isSystem: true,
  phases: [
    phase(1, 'Protezione', 'Dolore sotto controllo, guarigione documentata se struttura lesa', 7, 14, [
      { d: 'Guarigione o consolidazione documentata dal medico (se frattura o lesione strutturale)' },
      { d: 'Dolore a riposo entro 2/10', test: 'VAS a riposo', cmp: 'lte', target: 2, unit: '/10' },
      { d: 'Nessun dolore notturno' },
    ]),
    phase(2, 'ROM e forza di base', 'ROM simmetrico e cuffia oltre l\'80%', 14, 21, [
      { d: 'ROM attivo completo e simmetrico' },
      { d: 'Extrarotazione: forza almeno 80% del controlaterale', test: 'Extrarotatori LSI', cmp: 'gte', target: 80, unit: '%' },
      { d: 'Controllo scapolare corretto' },
    ]),
    phase(3, 'Forza e lavoro sopra la testa', 'Tenuta in catena chiusa e sopra la testa', 14, 21, [
      { d: 'Extrarotazione: forza almeno 90% del controlaterale', test: 'Extrarotatori LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'CKCUEST almeno 21 tocchi', test: 'CKCUEST', cmp: 'gte', target: 21, unit: 'tocchi' },
    ]),
    phase(4, 'Sport-specifico', 'Tiro, passaggio e rimbalzo', 10, 14, [
      { d: 'Tiri e passaggi a intensita\' di gara senza dolore' },
      { d: 'Contrasti e appoggi controllati' },
    ]),
    phase(5, 'Rientro', 'Allenamento completo e gara', 7, 10, [
      { d: 'Due allenamenti completi con contatto senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Clearance medica' },
    ]),
  ],
};

const UPPER_LIMB_BONE: RtpTemplate = {
  code: 'upper_limb_bone',
  name: 'Mano, polso e gomito — lesione ossea',
  description:
    'Fratture di dita, scafoide, polso e gomito. Qui il primo cancello non e\' un test di forza ma la ' +
    'consolidazione radiologica: prima di quella non si negozia nulla.',
  bodyRegion: 'upper_limb',
  injuryType: 'bone',
  isSystem: true,
  phases: [
    phase(1, 'Immobilizzazione e consolidazione', 'Rispettare i tempi biologici', 21, 30, [
      { d: 'Consolidazione documentata dal controllo radiografico' },
      { d: 'Immobilizzazione rispettata per il tempo indicato' },
      { d: 'Nessun dolore alla palpazione della sede' },
      { d: 'Lavoro cardiovascolare e di arto inferiore mantenuto in questa fase', opt: true },
    ]),
    phase(2, 'ROM e forza di presa', 'Recuperare articolarita\' e presa', 14, 21, [
      { d: 'ROM attivo completo e simmetrico' },
      { d: 'Forza di presa almeno 80% del controlaterale', test: 'Hand grip LSI', cmp: 'gte', target: 80, unit: '%' },
      { d: 'Nessun dolore nelle attivita\' quotidiane' },
    ]),
    phase(3, 'Ball handling e carico', 'Rimettere la palla in mano', 10, 14, [
      { d: 'Forza di presa almeno 90% del controlaterale', test: 'Hand grip LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Palleggio, presa e passaggio senza dolore' },
      { d: 'Tiro a distanza di gara senza dolore' },
      { d: 'Appoggio in carico sull\'arto (push-up) tollerato' },
    ]),
    phase(4, 'Contatto e rientro', 'Contrasti e gara, con protezione se indicata', 7, 10, [
      { d: 'Contrasti e lotta a rimbalzo senza dolore' },
      { d: 'Due allenamenti completi con contatto senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Tutore o taping di protezione concordato per il rientro', opt: true },
      { d: 'Clearance medica' },
    ]),
  ],
};

// ─── Rachide ─────────────────────────────────────────────

const SPINE_GENERIC: RtpTemplate = {
  code: 'spine_generic',
  name: 'Rachide — lombalgia e quadri vertebrali',
  description:
    'La resistenza dei muscoli del tronco conta piu\' della forza massimale. Le bandiere rosse (deficit ' +
    'neurologico, dolore notturno non meccanico) fermano il protocollo e rimandano al medico.',
  bodyRegion: 'spine',
  isSystem: true,
  phases: [
    phase(1, 'Controllo del dolore', 'Escludere bandiere rosse, riprendere il movimento', 5, 10, [
      { d: 'Nessun deficit neurologico (forza, sensibilita\', riflessi)' },
      { d: 'Guarigione o consolidazione documentata dal medico (se lesione ossea)' },
      { d: 'Dolore a riposo entro 3/10', test: 'VAS a riposo', cmp: 'lte', target: 3, unit: '/10' },
      { d: 'Cammino e attivita\' quotidiane senza dolore irradiato' },
    ]),
    phase(2, 'Controllo motorio e resistenza del tronco', 'Costruire tenuta del core', 14, 21, [
      { d: 'Plank frontale 60 secondi con tecnica corretta', test: 'Plank', cmp: 'gte', target: 60, unit: 'secondi' },
      { d: 'Side plank 45 secondi per lato', test: 'Side plank', cmp: 'gte', target: 45, unit: 'secondi' },
      { d: 'ROM lombare funzionale senza dolore' },
    ]),
    phase(3, 'Carico progressivo', 'Reintrodurre carico assiale e corsa', 14, 21, [
      { d: 'Squat e stacco a carico progressivo con tecnica corretta' },
      { d: 'Corsa 20 minuti senza dolore' },
      { d: 'Biering-Sorensen almeno 90 secondi', test: 'Biering-Sorensen', cmp: 'gte', target: 90, unit: 'secondi', opt: true },
    ]),
    phase(4, 'Sport-specifico', 'Salto, atterraggio, rotazioni e contatto leggero', 10, 14, [
      { d: 'Salti, atterraggi e rotazioni a intensita\' piena senza dolore' },
      { d: 'Drill difensivi e cambi di direzione completati' },
      { d: 'Nessuna recrudescenza nelle 24 h successive' },
    ]),
    phase(5, 'Rientro', 'Allenamento completo e gara', 7, 10, [
      { d: 'Due allenamenti completi con contatto senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Clearance medica' },
    ]),
  ],
};

// ─── Fallback per tipo e generico ────────────────────────

const BONE_GENERIC: RtpTemplate = {
  code: 'bone_generic',
  name: 'Lesione ossea — protocollo generico',
  description: 'Fallback per le fratture in sedi senza protocollo dedicato. Il primo criterio e\' sempre la consolidazione.',
  injuryType: 'bone',
  isSystem: true,
  phases: [
    phase(1, 'Consolidazione', 'Rispettare i tempi biologici', 21, 35, [
      { d: 'Consolidazione documentata dal controllo radiografico' },
      { d: 'Nessun dolore alla palpazione della sede' },
      { d: 'Carico progressivo autorizzato dal medico' },
    ]),
    phase(2, 'ROM e forza', 'Recuperare articolarita\' e forza di base', 14, 21, [
      { d: 'ROM attivo completo e simmetrico' },
      { d: 'Forza almeno 80% del controlaterale', test: 'Forza LSI', cmp: 'gte', target: 80, unit: '%' },
    ]),
    phase(3, 'Carico sportivo', 'Corsa, salto e gesto tecnico', 14, 21, [
      { d: 'Forza almeno 90% del controlaterale', test: 'Forza LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Corsa e salti senza dolore' },
      { d: 'Drill tecnici completati al 100% di intensita\'' },
    ]),
    phase(4, 'Contatto e rientro', 'Contatto pieno e gara', 10, 14, [
      { d: 'Due allenamenti completi con contatto senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Clearance medica firmata' },
    ]),
  ],
};

const DEFAULT_GENERIC: RtpTemplate = {
  code: 'default_generic',
  name: 'Protocollo generico',
  description:
    'Ultimo fallback: si applica quando nessun altro protocollo combacia. E\' il punto di partenza da duplicare ' +
    'e adattare quando serve un protocollo per una sede che la libreria non copre.',
  isSystem: true,
  phases: [
    phase(1, 'Protezione', 'Dolore e infiammazione sotto controllo', 5, 10, [
      { d: 'Dolore a riposo entro 2/10', test: 'VAS a riposo', cmp: 'lte', target: 2, unit: '/10' },
      { d: 'Nessun segno di infiammazione acuta' },
      { d: 'ROM passivo recuperato oltre il 70%', test: 'ROM passivo', cmp: 'gte', target: 70, unit: '%' },
    ]),
    phase(2, 'ROM e forza di base', 'ROM completo e forza oltre il 70%', 10, 14, [
      { d: 'Dolore nelle attivita\' quotidiane entro 2/10', test: 'VAS quotidiano', cmp: 'lte', target: 2, unit: '/10' },
      { d: 'ROM attivo completo e simmetrico' },
      { d: 'Forza isometrica almeno 70% del controlaterale', test: 'Forza LSI', cmp: 'gte', target: 70, unit: '%' },
    ]),
    phase(3, 'Carico e agilita\'', 'Corsa e cambi di direzione', 14, 21, [
      { d: 'Forza almeno 80% del controlaterale', test: 'Forza LSI', cmp: 'gte', target: 80, unit: '%' },
      { d: 'Corsa con cambi di direzione senza dolore' },
      { d: 'Drill di basket non-contatto completati' },
    ]),
    phase(4, 'Sport-specifico', 'Contatto limitato e intensita\' piena', 10, 14, [
      { d: 'Forza almeno 90% del controlaterale', test: 'Forza LSI', cmp: 'gte', target: 90, unit: '%' },
      { d: 'Allenamento con contatto limitato senza dolore' },
      { d: 'Drill sport-specifici al 100% di intensita\'' },
    ]),
    phase(5, 'Rientro', 'Allenamento completo e gara', 7, 10, [
      { d: 'Due allenamenti completi con la squadra senza sintomi', test: 'Sedute complete', cmp: 'gte', target: 2, unit: 'sedute' },
      { d: 'Nessuna reazione nelle 24 h successive' },
      { d: 'Clearance medica firmata' },
    ]),
  ],
};

/**
 * Tutti i template di sistema.
 *
 * L'ordine non conta per il matching (decide il punteggio di specificita'),
 * conta per come vengono elencati nella scheda Protocolli.
 */
export const RTP_SYSTEM_TEMPLATES: RtpTemplate[] = [
  KNEE_LIGAMENT_MAJOR,
  KNEE_LIGAMENT_MINOR,
  KNEE_TENDON,
  KNEE_GENERIC,
  ANKLE_LIGAMENT_MAJOR,
  ANKLE_LIGAMENT_MINOR,
  ANKLE_GENERIC,
  HAMSTRING_MUSCULAR,
  CALF_MUSCULAR,
  QUADRICEPS_MUSCULAR,
  GROIN_ANY,
  LOWER_LIMB_MUSCULAR,
  SHOULDER_INSTABILITY,
  SHOULDER_TENDON,
  SHOULDER_GENERIC,
  UPPER_LIMB_BONE,
  SPINE_GENERIC,
  BONE_GENERIC,
  DEFAULT_GENERIC,
];
