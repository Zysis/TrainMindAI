-- Protocolli RTP differenziati per zona, tipo di infortunio e severita'.
--
-- Prima esisteva una sola lista di criteri, hardcoded nella rotta: spalla e
-- ginocchio ricevevano gli stessi cinque step. Qui i protocolli diventano dati:
-- una libreria di template (19 di sistema, in sola lettura) da cui il
-- protocollo dell'atleta viene *copiato* all'avvio.
--
-- Perche' copiato e non referenziato: se il medico corregge il template a
-- meta' stagione, i protocolli gia' avviati non devono cambiare criteri sotto
-- i piedi dell'atleta. `templateId` resta solo come provenienza (SET NULL se
-- il template viene cancellato), le fasi vere sono le righe di
-- rtp_protocol_phases.
--
-- Il numero di fasi cambia col protocollo (3-6): una frattura di dito non ha
-- bisogno delle sei fasi di un LCA. L'enum RTPPhase resta come *posizione*
-- della fase, cosi' currentPhase, lo storico dei passaggi, i badge e i report
-- gia' scritti continuano a funzionare; la sesta posizione va aggiunta.
--
-- Idempotente: si puo' rilanciare. Il seed usa id deterministici
-- (`sys_<code>`) con upsert, quindi ri-applicarlo riallinea i template di
-- sistema senza spezzare i protocolli che ci puntano.

-- ─── 1. Sesta posizione di fase ─────────────────────────
-- BEFORE 'CLEARED' perche' l'ordine dell'enum e' quello con cui si ordinano
-- criteri e fasi: PHASE_6 dopo CLEARED darebbe un protocollo con il rientro
-- in mezzo. IF NOT EXISTS: `prisma db push` potrebbe averla gia' aggiunta.
ALTER TYPE "RTPPhase" ADD VALUE IF NOT EXISTS 'PHASE_6' BEFORE 'CLEARED';

-- ─── 2. Libreria dei template ───────────────────────────

CREATE TABLE IF NOT EXISTS "rtp_templates" (
  "id"             TEXT PRIMARY KEY,
  "organizationId" TEXT,
  "code"           TEXT,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "bodyZone"       TEXT,
  "bodyRegion"     TEXT,
  "injuryType"     TEXT,
  "severityMin"    INTEGER,
  "severityMax"    INTEGER,
  "isSystem"       BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "rtp_templates_code_key" ON "rtp_templates"("code");
CREATE INDEX IF NOT EXISTS "rtp_templates_organizationId_idx" ON "rtp_templates"("organizationId");
CREATE INDEX IF NOT EXISTS "rtp_templates_bodyZone_injuryType_idx" ON "rtp_templates"("bodyZone", "injuryType");

CREATE TABLE IF NOT EXISTS "rtp_template_phases" (
  "id"          TEXT PRIMARY KEY,
  "templateId"  TEXT NOT NULL,
  "order"       INTEGER NOT NULL,
  "name"        TEXT NOT NULL,
  "goal"        TEXT,
  "minDays"     INTEGER,
  "typicalDays" INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS "rtp_template_phases_templateId_order_key" ON "rtp_template_phases"("templateId", "order");
CREATE INDEX IF NOT EXISTS "rtp_template_phases_templateId_idx" ON "rtp_template_phases"("templateId");

CREATE TABLE IF NOT EXISTS "rtp_template_criteria" (
  "id"          TEXT PRIMARY KEY,
  "phaseId"     TEXT NOT NULL,
  "order"       INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "testCode"    TEXT,
  "comparator"  TEXT,
  "targetValue" DOUBLE PRECISION,
  "unit"        TEXT,
  "mandatory"   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS "rtp_template_criteria_phaseId_idx" ON "rtp_template_criteria"("phaseId");

-- ─── 3. Fasi del singolo protocollo ─────────────────────

CREATE TABLE IF NOT EXISTS "rtp_protocol_phases" (
  "id"            TEXT PRIMARY KEY,
  "rtpProtocolId" TEXT NOT NULL,
  "phase"         "RTPPhase" NOT NULL,
  "order"         INTEGER NOT NULL,
  "name"          TEXT NOT NULL,
  "goal"          TEXT,
  "minDays"       INTEGER,
  "typicalDays"   INTEGER,
  "startedAt"     TIMESTAMP(3),
  "completedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "rtp_protocol_phases_rtpProtocolId_phase_key" ON "rtp_protocol_phases"("rtpProtocolId", "phase");
CREATE INDEX IF NOT EXISTS "rtp_protocol_phases_rtpProtocolId_idx" ON "rtp_protocol_phases"("rtpProtocolId");

-- ─── 4. Colonne nuove su tabelle esistenti ──────────────

ALTER TABLE "rtp_protocols"     ADD COLUMN IF NOT EXISTS "templateId"    TEXT;
ALTER TABLE "rtp_protocols"     ADD COLUMN IF NOT EXISTS "templateName"  TEXT;

ALTER TABLE "clearance_criteria" ADD COLUMN IF NOT EXISTS "testCode"      TEXT;
ALTER TABLE "clearance_criteria" ADD COLUMN IF NOT EXISTS "comparator"    TEXT;
ALTER TABLE "clearance_criteria" ADD COLUMN IF NOT EXISTS "targetValue"   DOUBLE PRECISION;
ALTER TABLE "clearance_criteria" ADD COLUMN IF NOT EXISTS "unit"          TEXT;
ALTER TABLE "clearance_criteria" ADD COLUMN IF NOT EXISTS "measuredValue" DOUBLE PRECISION;
ALTER TABLE "clearance_criteria" ADD COLUMN IF NOT EXISTS "mandatory"     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "clearance_criteria" ADD COLUMN IF NOT EXISTS "order"         INTEGER NOT NULL DEFAULT 0;

-- ─── 4bis. Default su updatedAt ─────────────────────────
-- Queste tabelle possono essere nate da `prisma db push` invece che da questa
-- migration. In quel caso `updatedAt` e' NOT NULL *senza* default, perche'
-- `@updatedAt` di Prisma lo scrive il client e non il database — e il
-- `CREATE TABLE IF NOT EXISTS` qui sopra ha saltato la tabella, default
-- compreso. Il seed della sezione 6 non passa `updatedAt`, quindi senza questo
-- blocco muore su `null value in column "updatedAt"` e non inserisce niente.
-- E' successo davvero, in produzione, il 3/9/2026.
ALTER TABLE "rtp_templates"       ALTER COLUMN "createdAt" SET DEFAULT NOW();
ALTER TABLE "rtp_templates"       ALTER COLUMN "updatedAt" SET DEFAULT NOW();
ALTER TABLE "rtp_protocol_phases" ALTER COLUMN "createdAt" SET DEFAULT NOW();
ALTER TABLE "rtp_protocol_phases" ALTER COLUMN "updatedAt" SET DEFAULT NOW();

-- ─── 5. Vincoli ─────────────────────────────────────────
-- In DO block con guardia su pg_constraint: `db push` potrebbe averli gia'
-- creati, e ALTER TABLE ADD CONSTRAINT non ha IF NOT EXISTS.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rtp_templates_organizationId_fkey') THEN
    ALTER TABLE "rtp_templates" ADD CONSTRAINT "rtp_templates_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rtp_template_phases_templateId_fkey') THEN
    ALTER TABLE "rtp_template_phases" ADD CONSTRAINT "rtp_template_phases_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "rtp_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rtp_template_criteria_phaseId_fkey') THEN
    ALTER TABLE "rtp_template_criteria" ADD CONSTRAINT "rtp_template_criteria_phaseId_fkey"
      FOREIGN KEY ("phaseId") REFERENCES "rtp_template_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rtp_protocol_phases_rtpProtocolId_fkey') THEN
    ALTER TABLE "rtp_protocol_phases" ADD CONSTRAINT "rtp_protocol_phases_rtpProtocolId_fkey"
      FOREIGN KEY ("rtpProtocolId") REFERENCES "rtp_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- SET NULL e non CASCADE: cancellare un template non deve cancellare i
  -- protocolli nati da quel template. E' la stessa regola applicata a mesocicli
  -- e periodizzazioni nella migration del 28 agosto.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rtp_protocols_templateId_fkey') THEN
    ALTER TABLE "rtp_protocols" ADD CONSTRAINT "rtp_protocols_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "rtp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 6. Seed dei template di sistema ────────────────────
-- 19 template di sistema, 92 fasi, 272 criteri.
-- Generato da scripts/gen-rtp-seed.mjs: non modificare a mano, si rigenera.

INSERT INTO rtp_templates (id, "organizationId", code, name, description, "bodyZone", "bodyRegion", "injuryType", "severityMin", "severityMax", "isSystem", "isActive") VALUES
  ('sys_knee_ligament_major', NULL, 'knee_ligament_major', 'Ginocchio — lesione legamentosa maggiore (LCA/LCM di grado elevato)', 'Sei fasi su circa otto mesi. La forza del quadricipite e la batteria di hop test sono i due cancelli che contano; l''ACL-RSI misura la disponibilita'' psicologica, che e'' un predittore di re-infortunio quanto la forza.', 'knee', NULL, 'ligament', 3, 5, TRUE, TRUE),
  ('sys_knee_ligament_minor', NULL, 'knee_ligament_minor', 'Ginocchio — distorsione legamentosa lieve', 'Quattro fasi su circa un mese: LCM di grado I-II e distorsioni senza instabilita''.', 'knee', NULL, 'ligament', 1, 2, TRUE, TRUE),
  ('sys_knee_tendon', NULL, 'knee_tendon', 'Ginocchio — tendinopatia rotulea', 'Il dolore non deve sparire prima di caricare: si progredisce mantenendo il dolore entro 3/10 durante l''esercizio e senza peggioramento il mattino dopo. Il VISA-P e'' il punteggio di riferimento.', 'knee', NULL, 'tendon', NULL, NULL, TRUE, TRUE),
  ('sys_knee_generic', NULL, 'knee_generic', 'Ginocchio — protocollo generico', 'Fallback di zona: meniscopatie, contusioni articolari e quadri non coperti dai protocolli specifici.', 'knee', NULL, NULL, NULL, NULL, TRUE, TRUE),
  ('sys_ankle_ligament_major', NULL, 'ankle_ligament_major', 'Caviglia — distorsione di grado elevato', 'La distorsione di caviglia e'' l''infortunio piu'' frequente e quello con la recidiva piu'' alta, quasi sempre per un rientro deciso sul dolore invece che sul controllo. Equilibrio monopodalico e CAIT sono i criteri che discriminano davvero.', 'ankle', NULL, 'ligament', 3, 5, TRUE, TRUE),
  ('sys_ankle_ligament_minor', NULL, 'ankle_ligament_minor', 'Caviglia — distorsione lieve', 'Quattro fasi su circa due settimane. Il criterio da non saltare resta l''equilibrio monopodalico.', 'ankle', NULL, 'ligament', 1, 2, TRUE, TRUE),
  ('sys_ankle_generic', NULL, 'ankle_generic', 'Caviglia — protocollo generico', 'Fallback di zona per quadri non legamentosi: contusioni, sovraccarichi, quadri articolari.', 'ankle', NULL, NULL, NULL, NULL, TRUE, TRUE),
  ('sys_hamstring_muscular', NULL, 'hamstring_muscular', 'Ischiocrurali — lesione muscolare', 'La recidiva si gioca sulla forza a lunghezza estesa e sulla velocita'' massimale: rientrare senza aver sprintato a velocita'' piena e'' il modo classico per rifarsi male. L''H-test di Askling e'' il criterio che intercetta l''apprensione residua.', 'hamstring', NULL, 'muscular', NULL, NULL, TRUE, TRUE),
  ('sys_calf_muscular', NULL, 'calf_muscular', 'Polpaccio — lesione muscolare', 'Il criterio guida e'' la capacita'' di lavoro del tricipite surale: le salite sulle punte monopodaliche.', 'calf', NULL, 'muscular', NULL, NULL, TRUE, TRUE),
  ('sys_quadriceps_muscular', NULL, 'quadriceps_muscular', 'Quadricipite — lesione muscolare', 'Attenzione al retto femorale: e'' biarticolare e va testato anche in allungamento, con l''anca estesa.', 'quadriceps', NULL, 'muscular', NULL, NULL, TRUE, TRUE),
  ('sys_groin_any', NULL, 'groin_any', 'Adduttori e inguine', 'Il test di riferimento e'' lo squeeze test degli adduttori a 45 gradi; il Copenhagen adduction e'' insieme esercizio e criterio di tolleranza.', 'groin', NULL, NULL, NULL, NULL, TRUE, TRUE),
  ('sys_lower_limb_muscular', NULL, 'lower_limb_muscular', 'Arto inferiore — lesione muscolare (generico)', 'Fallback di regione per i muscoli senza protocollo dedicato: anca, ileopsoas, piede.', NULL, 'lower_limb', 'muscular', NULL, NULL, TRUE, TRUE),
  ('sys_shoulder_instability', NULL, 'shoulder_instability', 'Spalla — instabilita'' e lesione capsulo-legamentosa', 'Qui i criteri non hanno nulla a che vedere con quelli di un arto inferiore: contano il controllo scapolare, il rapporto fra extrarotatori e intrarotatori e la tenuta in catena chiusa (CKCUEST). Il test di apprensione negativo e'' il cancello per il contatto.', 'shoulder', NULL, 'ligament', NULL, NULL, TRUE, TRUE),
  ('sys_shoulder_tendon', NULL, 'shoulder_tendon', 'Spalla — tendinopatia della cuffia', 'Progressione sul carico tollerato, con il dolore entro 3/10 durante l''esercizio e nessun peggioramento il giorno dopo.', 'shoulder', NULL, 'tendon', NULL, NULL, TRUE, TRUE),
  ('sys_shoulder_generic', NULL, 'shoulder_generic', 'Spalla — protocollo generico', 'Fallback di zona per quadri diversi da instabilita'' e tendinopatia, comprese le lesioni ossee della cintura scapolare: in quel caso il primo criterio della fase 1 e'' la guarigione documentata.', 'shoulder', NULL, NULL, NULL, NULL, TRUE, TRUE),
  ('sys_upper_limb_bone', NULL, 'upper_limb_bone', 'Mano, polso e gomito — lesione ossea', 'Fratture di dita, scafoide, polso e gomito. Qui il primo cancello non e'' un test di forza ma la consolidazione radiologica: prima di quella non si negozia nulla.', NULL, 'upper_limb', 'bone', NULL, NULL, TRUE, TRUE),
  ('sys_spine_generic', NULL, 'spine_generic', 'Rachide — lombalgia e quadri vertebrali', 'La resistenza dei muscoli del tronco conta piu'' della forza massimale. Le bandiere rosse (deficit neurologico, dolore notturno non meccanico) fermano il protocollo e rimandano al medico.', NULL, 'spine', NULL, NULL, NULL, TRUE, TRUE),
  ('sys_bone_generic', NULL, 'bone_generic', 'Lesione ossea — protocollo generico', 'Fallback per le fratture in sedi senza protocollo dedicato. Il primo criterio e'' sempre la consolidazione.', NULL, NULL, 'bone', NULL, NULL, TRUE, TRUE),
  ('sys_default_generic', NULL, 'default_generic', 'Protocollo generico', 'Ultimo fallback: si applica quando nessun altro protocollo combacia. E'' il punto di partenza da duplicare e adattare quando serve un protocollo per una sede che la libreria non copre.', NULL, NULL, NULL, NULL, NULL, TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  "bodyZone" = EXCLUDED."bodyZone", "bodyRegion" = EXCLUDED."bodyRegion",
  "injuryType" = EXCLUDED."injuryType",
  "severityMin" = EXCLUDED."severityMin", "severityMax" = EXCLUDED."severityMax",
  "isSystem" = TRUE, "updatedAt" = NOW();

INSERT INTO rtp_template_phases (id, "templateId", "order", name, goal, "minDays", "typicalDays") VALUES
  ('sys_knee_ligament_major_p1', 'sys_knee_ligament_major', 1, 'Protezione e controllo dell''effusione', 'Spegnere infiammazione e dolore, riprendere l''estensione completa', 7, 14),
  ('sys_knee_ligament_major_p2', 'sys_knee_ligament_major', 2, 'Recupero del ROM e della forza di base', 'Flessione completa, quadricipite oltre il 70%, nessuna reazione al carico', 30, 42),
  ('sys_knee_ligament_major_p3', 'sys_knee_ligament_major', 3, 'Forza e ritorno alla corsa', 'Corsa lineare tollerata, quadricipite oltre l''80%', 45, 60),
  ('sys_knee_ligament_major_p4', 'sys_knee_ligament_major', 4, 'Sport-specifico senza contatto', 'Cambi di direzione e gesto tecnico completo, batteria hop oltre il 90%', 45, 60),
  ('sys_knee_ligament_major_p5', 'sys_knee_ligament_major', 5, 'Allenamento completo con la squadra', 'Contatto, carico pieno e disponibilita'' psicologica', 30, 45),
  ('sys_knee_ligament_major_p6', 'sys_knee_ligament_major', 6, 'Ritorno alla partita', 'Rientro graduale in gara con minutaggio concordato', 21, 30),
  ('sys_knee_ligament_minor_p1', 'sys_knee_ligament_minor', 1, 'Controllo del dolore', 'Carico completo senza zoppia', 2, 5),
  ('sys_knee_ligament_minor_p2', 'sys_knee_ligament_minor', 2, 'ROM e forza', 'ROM completo, quadricipite oltre l''80%', 5, 10),
  ('sys_knee_ligament_minor_p3', 'sys_knee_ligament_minor', 3, 'Sport-specifico', 'Cambi di direzione e salti senza sintomi', 5, 10),
  ('sys_knee_ligament_minor_p4', 'sys_knee_ligament_minor', 4, 'Rientro', 'Allenamento completo e gara', 3, 7),
  ('sys_knee_tendon_p1', 'sys_knee_tendon', 1, 'Isometrie e riduzione del carico irritativo', 'Abbassare il dolore senza fermare il tendine', 7, 14),
  ('sys_knee_tendon_p2', 'sys_knee_tendon', 2, 'Forza lenta e pesante', 'Costruire capacita'' di carico del tendine', 21, 28),
  ('sys_knee_tendon_p3', 'sys_knee_tendon', 3, 'Energy storage: pliometria progressiva', 'Reintrodurre salto e atterraggio', 14, 21),
  ('sys_knee_tendon_p4', 'sys_knee_tendon', 4, 'Sport-specifico', 'Volume di salti da allenamento', 10, 14),
  ('sys_knee_tendon_p5', 'sys_knee_tendon', 5, 'Rientro e gestione del carico', 'Gara con monitoraggio del volume di salti', 7, 14),
  ('sys_knee_generic_p1', 'sys_knee_generic', 1, 'Protezione', 'Dolore e versamento sotto controllo', 5, 10),
  ('sys_knee_generic_p2', 'sys_knee_generic', 2, 'ROM e forza', 'Flessione completa e quadricipite oltre il 75%', 14, 21),
  ('sys_knee_generic_p3', 'sys_knee_generic', 3, 'Corsa e agilita''', 'Corsa e cambi di direzione senza sintomi', 14, 21),
  ('sys_knee_generic_p4', 'sys_knee_generic', 4, 'Sport-specifico', 'Drill di squadra senza contatto', 10, 14),
  ('sys_knee_generic_p5', 'sys_knee_generic', 5, 'Rientro', 'Allenamento completo e gara', 7, 10),
  ('sys_ankle_ligament_major_p1', 'sys_ankle_ligament_major', 1, 'Protezione e carico', 'Carico completo senza zoppia', 3, 7),
  ('sys_ankle_ligament_major_p2', 'sys_ankle_ligament_major', 2, 'ROM, forza e propriocezione', 'Dorsiflessione simmetrica e appoggio monopodalico stabile', 10, 14),
  ('sys_ankle_ligament_major_p3', 'sys_ankle_ligament_major', 3, 'Corsa e salti', 'Corsa, salto e atterraggio senza dolore', 10, 14),
  ('sys_ankle_ligament_major_p4', 'sys_ankle_ligament_major', 4, 'Sport-specifico', 'Cambi di direzione e gesto tecnico completo', 7, 12),
  ('sys_ankle_ligament_major_p5', 'sys_ankle_ligament_major', 5, 'Rientro', 'Allenamento completo e gara', 5, 10),
  ('sys_ankle_ligament_minor_p1', 'sys_ankle_ligament_minor', 1, 'Controllo del dolore', 'Carico completo', 1, 3),
  ('sys_ankle_ligament_minor_p2', 'sys_ankle_ligament_minor', 2, 'ROM e propriocezione', 'Dorsiflessione simmetrica, equilibrio recuperato', 3, 5),
  ('sys_ankle_ligament_minor_p3', 'sys_ankle_ligament_minor', 3, 'Corsa e salti', 'Salto e cambio di direzione senza dolore', 3, 5),
  ('sys_ankle_ligament_minor_p4', 'sys_ankle_ligament_minor', 4, 'Rientro', 'Allenamento completo e gara', 2, 4),
  ('sys_ankle_generic_p1', 'sys_ankle_generic', 1, 'Protezione', 'Dolore e gonfiore sotto controllo', 3, 7),
  ('sys_ankle_generic_p2', 'sys_ankle_generic', 2, 'ROM e forza', 'Dorsiflessione simmetrica e forza recuperata', 7, 12),
  ('sys_ankle_generic_p3', 'sys_ankle_generic', 3, 'Corsa e salti', 'Corsa e pliometria senza sintomi', 7, 12),
  ('sys_ankle_generic_p4', 'sys_ankle_generic', 4, 'Sport-specifico', 'Gesto tecnico completo', 5, 10),
  ('sys_ankle_generic_p5', 'sys_ankle_generic', 5, 'Rientro', 'Allenamento completo e gara', 5, 7),
  ('sys_hamstring_muscular_p1', 'sys_hamstring_muscular', 1, 'Protezione', 'Cammino normale, dolore sotto controllo', 3, 5),
  ('sys_hamstring_muscular_p2', 'sys_hamstring_muscular', 2, 'Forza e allungamento controllato', 'Recuperare forza a lunghezza crescente', 7, 12),
  ('sys_hamstring_muscular_p3', 'sys_hamstring_muscular', 3, 'Eccentrico e corsa veloce', 'Tolleranza eccentrica e progressione della velocita''', 10, 14),
  ('sys_hamstring_muscular_p4', 'sys_hamstring_muscular', 4, 'Velocita'' massimale e sport-specifico', 'Sprint pieno e gesto di gara', 7, 12),
  ('sys_hamstring_muscular_p5', 'sys_hamstring_muscular', 5, 'Rientro', 'Allenamento completo e gara', 5, 7),
  ('sys_calf_muscular_p1', 'sys_calf_muscular', 1, 'Protezione', 'Cammino normale', 3, 5),
  ('sys_calf_muscular_p2', 'sys_calf_muscular', 2, 'Forza', 'Capacita'' di lavoro monopodalica', 7, 12),
  ('sys_calf_muscular_p3', 'sys_calf_muscular', 3, 'Pliometria e velocita''', 'Salto e corsa veloce', 7, 12),
  ('sys_calf_muscular_p4', 'sys_calf_muscular', 4, 'Sport-specifico', 'Gesto di gara completo', 5, 8),
  ('sys_calf_muscular_p5', 'sys_calf_muscular', 5, 'Rientro', 'Allenamento completo e gara', 4, 6),
  ('sys_quadriceps_muscular_p1', 'sys_quadriceps_muscular', 1, 'Protezione', 'Cammino normale e contrazione indolore', 3, 5),
  ('sys_quadriceps_muscular_p2', 'sys_quadriceps_muscular', 2, 'Forza', 'Forza concentrica recuperata', 7, 12),
  ('sys_quadriceps_muscular_p3', 'sys_quadriceps_muscular', 3, 'Eccentrico e pliometria', 'Tolleranza al carico eccentrico e al salto', 7, 14),
  ('sys_quadriceps_muscular_p4', 'sys_quadriceps_muscular', 4, 'Sport-specifico', 'Sprint e cambi di direzione a intensita'' piena', 5, 10),
  ('sys_quadriceps_muscular_p5', 'sys_quadriceps_muscular', 5, 'Rientro', 'Allenamento completo e gara', 4, 6),
  ('sys_groin_any_p1', 'sys_groin_any', 1, 'Controllo del dolore', 'Cammino e vita quotidiana senza dolore', 3, 7),
  ('sys_groin_any_p2', 'sys_groin_any', 2, 'Forza isometrica', 'Recuperare forza degli adduttori', 10, 14),
  ('sys_groin_any_p3', 'sys_groin_any', 3, 'Forza eccentrica e cambi di direzione', 'Copenhagen tollerato, cambi di direzione progressivi', 10, 14),
  ('sys_groin_any_p4', 'sys_groin_any', 4, 'Sport-specifico', 'Scivolamenti difensivi e gesto di gara', 7, 10),
  ('sys_groin_any_p5', 'sys_groin_any', 5, 'Rientro', 'Allenamento completo e gara', 5, 7),
  ('sys_lower_limb_muscular_p1', 'sys_lower_limb_muscular', 1, 'Protezione', 'Cammino normale', 3, 5),
  ('sys_lower_limb_muscular_p2', 'sys_lower_limb_muscular', 2, 'Forza', 'Forza oltre l''80% del controlaterale', 7, 12),
  ('sys_lower_limb_muscular_p3', 'sys_lower_limb_muscular', 3, 'Eccentrico e velocita''', 'Carico eccentrico e corsa veloce', 7, 12),
  ('sys_lower_limb_muscular_p4', 'sys_lower_limb_muscular', 4, 'Sport-specifico', 'Gesto di gara completo', 5, 10),
  ('sys_lower_limb_muscular_p5', 'sys_lower_limb_muscular', 5, 'Rientro', 'Allenamento completo e gara', 4, 7),
  ('sys_shoulder_instability_p1', 'sys_shoulder_instability', 1, 'Protezione e ROM protetto', 'Dolore sotto controllo, ROM nei limiti concessi', 10, 21),
  ('sys_shoulder_instability_p2', 'sys_shoulder_instability', 2, 'ROM completo e forza di base', 'ROM simmetrico e cuffia oltre il 70%', 21, 30),
  ('sys_shoulder_instability_p3', 'sys_shoulder_instability', 3, 'Forza e controllo in catena chiusa', 'Tenuta sopra la testa e in appoggio', 21, 30),
  ('sys_shoulder_instability_p4', 'sys_shoulder_instability', 4, 'Sport-specifico senza contatto', 'Passaggio, tiro e rimbalzo a intensita'' piena', 14, 21),
  ('sys_shoulder_instability_p5', 'sys_shoulder_instability', 5, 'Contatto e rientro', 'Contrasti, rimbalzi e gara', 10, 14),
  ('sys_shoulder_tendon_p1', 'sys_shoulder_tendon', 1, 'Riduzione del carico irritativo', 'Abbassare il dolore, mantenere il movimento', 7, 14),
  ('sys_shoulder_tendon_p2', 'sys_shoulder_tendon', 2, 'Forza isometrica e controllo scapolare', 'Costruire tolleranza al carico', 14, 21),
  ('sys_shoulder_tendon_p3', 'sys_shoulder_tendon', 3, 'Forza dinamica e lavoro sopra la testa', 'Riprendere il gesto sopra la testa', 14, 21),
  ('sys_shoulder_tendon_p4', 'sys_shoulder_tendon', 4, 'Sport-specifico', 'Volume di tiro da allenamento', 10, 14),
  ('sys_shoulder_tendon_p5', 'sys_shoulder_tendon', 5, 'Rientro e gestione del carico', 'Gara con volume di tiro monitorato', 7, 10),
  ('sys_shoulder_generic_p1', 'sys_shoulder_generic', 1, 'Protezione', 'Dolore sotto controllo, guarigione documentata se struttura lesa', 7, 14),
  ('sys_shoulder_generic_p2', 'sys_shoulder_generic', 2, 'ROM e forza di base', 'ROM simmetrico e cuffia oltre l''80%', 14, 21),
  ('sys_shoulder_generic_p3', 'sys_shoulder_generic', 3, 'Forza e lavoro sopra la testa', 'Tenuta in catena chiusa e sopra la testa', 14, 21),
  ('sys_shoulder_generic_p4', 'sys_shoulder_generic', 4, 'Sport-specifico', 'Tiro, passaggio e rimbalzo', 10, 14),
  ('sys_shoulder_generic_p5', 'sys_shoulder_generic', 5, 'Rientro', 'Allenamento completo e gara', 7, 10),
  ('sys_upper_limb_bone_p1', 'sys_upper_limb_bone', 1, 'Immobilizzazione e consolidazione', 'Rispettare i tempi biologici', 21, 30),
  ('sys_upper_limb_bone_p2', 'sys_upper_limb_bone', 2, 'ROM e forza di presa', 'Recuperare articolarita'' e presa', 14, 21),
  ('sys_upper_limb_bone_p3', 'sys_upper_limb_bone', 3, 'Ball handling e carico', 'Rimettere la palla in mano', 10, 14),
  ('sys_upper_limb_bone_p4', 'sys_upper_limb_bone', 4, 'Contatto e rientro', 'Contrasti e gara, con protezione se indicata', 7, 10),
  ('sys_spine_generic_p1', 'sys_spine_generic', 1, 'Controllo del dolore', 'Escludere bandiere rosse, riprendere il movimento', 5, 10),
  ('sys_spine_generic_p2', 'sys_spine_generic', 2, 'Controllo motorio e resistenza del tronco', 'Costruire tenuta del core', 14, 21),
  ('sys_spine_generic_p3', 'sys_spine_generic', 3, 'Carico progressivo', 'Reintrodurre carico assiale e corsa', 14, 21),
  ('sys_spine_generic_p4', 'sys_spine_generic', 4, 'Sport-specifico', 'Salto, atterraggio, rotazioni e contatto leggero', 10, 14),
  ('sys_spine_generic_p5', 'sys_spine_generic', 5, 'Rientro', 'Allenamento completo e gara', 7, 10),
  ('sys_bone_generic_p1', 'sys_bone_generic', 1, 'Consolidazione', 'Rispettare i tempi biologici', 21, 35),
  ('sys_bone_generic_p2', 'sys_bone_generic', 2, 'ROM e forza', 'Recuperare articolarita'' e forza di base', 14, 21),
  ('sys_bone_generic_p3', 'sys_bone_generic', 3, 'Carico sportivo', 'Corsa, salto e gesto tecnico', 14, 21),
  ('sys_bone_generic_p4', 'sys_bone_generic', 4, 'Contatto e rientro', 'Contatto pieno e gara', 10, 14),
  ('sys_default_generic_p1', 'sys_default_generic', 1, 'Protezione', 'Dolore e infiammazione sotto controllo', 5, 10),
  ('sys_default_generic_p2', 'sys_default_generic', 2, 'ROM e forza di base', 'ROM completo e forza oltre il 70%', 10, 14),
  ('sys_default_generic_p3', 'sys_default_generic', 3, 'Carico e agilita''', 'Corsa e cambi di direzione', 14, 21),
  ('sys_default_generic_p4', 'sys_default_generic', 4, 'Sport-specifico', 'Contatto limitato e intensita'' piena', 10, 14),
  ('sys_default_generic_p5', 'sys_default_generic', 5, 'Rientro', 'Allenamento completo e gara', 7, 10)
ON CONFLICT (id) DO UPDATE SET
  "order" = EXCLUDED."order", name = EXCLUDED.name, goal = EXCLUDED.goal,
  "minDays" = EXCLUDED."minDays", "typicalDays" = EXCLUDED."typicalDays";

INSERT INTO rtp_template_criteria (id, "phaseId", "order", description, "testCode", comparator, "targetValue", unit, mandatory) VALUES
  ('sys_knee_ligament_major_p1_c1', 'sys_knee_ligament_major_p1', 1, 'Dolore a riposo entro 2/10', 'VAS a riposo', 'lte', 2, '/10', TRUE),
  ('sys_knee_ligament_major_p1_c2', 'sys_knee_ligament_major_p1', 2, 'Versamento assente o minimo (stroke test 0/1+)', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_major_p1_c3', 'sys_knee_ligament_major_p1', 3, 'Estensione passiva completa, simmetrica al controlaterale', 'Deficit di estensione', 'lte', 0, 'gradi', TRUE),
  ('sys_knee_ligament_major_p1_c4', 'sys_knee_ligament_major_p1', 4, 'Contrazione volontaria del quadricipite senza extension lag', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_major_p1_c5', 'sys_knee_ligament_major_p1', 5, 'Cammino senza stampelle e senza zoppia', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_major_p2_c1', 'sys_knee_ligament_major_p2', 1, 'Flessione attiva almeno 125 gradi', 'Flessione attiva', 'gte', 125, 'gradi', TRUE),
  ('sys_knee_ligament_major_p2_c2', 'sys_knee_ligament_major_p2', 2, 'Nessun versamento nelle 24 h dopo la seduta di carico', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_major_p2_c3', 'sys_knee_ligament_major_p2', 3, 'Forza isometrica del quadricipite almeno 70% del controlaterale', 'Quadricipite LSI', 'gte', 70, '%', TRUE),
  ('sys_knee_ligament_major_p2_c4', 'sys_knee_ligament_major_p2', 4, 'Salita e discesa delle scale senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_major_p2_c5', 'sys_knee_ligament_major_p2', 5, 'Bici ed ellittica 20 minuti senza sintomi', NULL, NULL, NULL, NULL, FALSE),
  ('sys_knee_ligament_major_p3_c1', 'sys_knee_ligament_major_p3', 1, 'Forza del quadricipite almeno 80% del controlaterale', 'Quadricipite LSI', 'gte', 80, '%', TRUE),
  ('sys_knee_ligament_major_p3_c2', 'sys_knee_ligament_major_p3', 2, 'Rapporto ischiocrurali/quadricipite almeno 0.55', 'H/Q ratio', 'gte', 0.55, 'rapporto', TRUE),
  ('sys_knee_ligament_major_p3_c3', 'sys_knee_ligament_major_p3', 3, 'Corsa lineare 20 minuti senza dolore ne'' versamento', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_major_p3_c4', 'sys_knee_ligament_major_p3', 4, 'Single leg hop test almeno 80% del controlaterale', 'Single hop LSI', 'gte', 80, '%', TRUE),
  ('sys_knee_ligament_major_p3_c5', 'sys_knee_ligament_major_p3', 5, 'Y-Balance anteriore: differenza tra i due arti sotto i 4 cm', 'Y-Balance ANT', 'lte', 4, 'cm', FALSE),
  ('sys_knee_ligament_major_p4_c1', 'sys_knee_ligament_major_p4', 1, 'Forza del quadricipite almeno 90% del controlaterale', 'Quadricipite LSI', 'gte', 90, '%', TRUE),
  ('sys_knee_ligament_major_p4_c2', 'sys_knee_ligament_major_p4', 2, 'Batteria hop test (singolo, triplo, crossover, 6 m a tempo) tutti almeno 90%', 'Hop battery LSI', 'gte', 90, '%', TRUE),
  ('sys_knee_ligament_major_p4_c3', 'sys_knee_ligament_major_p4', 3, 'Cambi di direzione e decelerazioni a intensita'' progressiva senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_major_p4_c4', 'sys_knee_ligament_major_p4', 4, 'Drill di tiro, palleggio e scivolamenti difensivi completati al 100%', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_major_p4_c5', 'sys_knee_ligament_major_p4', 5, 'Nessun versamento nelle 24 h successive alle sedute intense', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_major_p5_c1', 'sys_knee_ligament_major_p5', 1, 'Almeno 4 allenamenti completi con contatto senza sintomi', 'Sedute complete', 'gte', 4, 'sedute', TRUE),
  ('sys_knee_ligament_major_p5_c2', 'sys_knee_ligament_major_p5', 2, 'Forza del quadricipite almeno 95% del controlaterale', 'Quadricipite LSI', 'gte', 95, '%', TRUE),
  ('sys_knee_ligament_major_p5_c3', 'sys_knee_ligament_major_p5', 3, 'ACL-RSI almeno 65', 'ACL-RSI', 'gte', 65, 'punti', TRUE),
  ('sys_knee_ligament_major_p5_c4', 'sys_knee_ligament_major_p5', 4, 'Carico settimanale (sRPE) allineato ai compagni di ruolo, ACWR fra 0.8 e 1.3', NULL, NULL, NULL, NULL, FALSE),
  ('sys_knee_ligament_major_p6_c1', 'sys_knee_ligament_major_p6', 1, 'Clearance medica firmata', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_major_p6_c2', 'sys_knee_ligament_major_p6', 2, 'Nessun episodio di cedimento (giving way) negli ultimi 30 giorni', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_major_p6_c3', 'sys_knee_ligament_major_p6', 3, 'ACL-RSI almeno 76', 'ACL-RSI', 'gte', 76, 'punti', TRUE),
  ('sys_knee_ligament_major_p6_c4', 'sys_knee_ligament_major_p6', 4, 'Minutaggio progressivo concordato per le prime tre partite', NULL, NULL, NULL, NULL, FALSE),
  ('sys_knee_ligament_minor_p1_c1', 'sys_knee_ligament_minor_p1', 1, 'Dolore a riposo entro 2/10', 'VAS a riposo', 'lte', 2, '/10', TRUE),
  ('sys_knee_ligament_minor_p1_c2', 'sys_knee_ligament_minor_p1', 2, 'Versamento assente o minimo', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_minor_p1_c3', 'sys_knee_ligament_minor_p1', 3, 'Carico completo senza zoppia', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_minor_p2_c1', 'sys_knee_ligament_minor_p2', 1, 'ROM attivo completo e simmetrico', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_minor_p2_c2', 'sys_knee_ligament_minor_p2', 2, 'Forza isometrica del quadricipite almeno 80% del controlaterale', 'Quadricipite LSI', 'gte', 80, '%', TRUE),
  ('sys_knee_ligament_minor_p2_c3', 'sys_knee_ligament_minor_p2', 3, 'Corsa lineare senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_minor_p3_c1', 'sys_knee_ligament_minor_p3', 1, 'Single leg hop test almeno 90%', 'Single hop LSI', 'gte', 90, '%', TRUE),
  ('sys_knee_ligament_minor_p3_c2', 'sys_knee_ligament_minor_p3', 2, 'Cambi di direzione a intensita'' piena senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_minor_p3_c3', 'sys_knee_ligament_minor_p3', 3, 'Drill di tiro e difesa completati', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_minor_p4_c1', 'sys_knee_ligament_minor_p4', 1, 'Due allenamenti completi con contatto senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_knee_ligament_minor_p4_c2', 'sys_knee_ligament_minor_p4', 2, 'Nessun gonfiore post-allenamento', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_ligament_minor_p4_c3', 'sys_knee_ligament_minor_p4', 3, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_tendon_p1_c1', 'sys_knee_tendon_p1', 1, 'Dolore durante il single leg decline squat entro 3/10', 'Decline squat VAS', 'lte', 3, '/10', TRUE),
  ('sys_knee_tendon_p1_c2', 'sys_knee_tendon_p1', 2, 'Nessun peggioramento del dolore il mattino successivo', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_tendon_p1_c3', 'sys_knee_tendon_p1', 3, 'Tolleranza a 5 isometrie da 45 secondi', 'Isometrie', 'gte', 5, 'serie', TRUE),
  ('sys_knee_tendon_p1_c4', 'sys_knee_tendon_p1', 4, 'Salti e pliometria sospesi in questa fase', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_tendon_p2_c1', 'sys_knee_tendon_p2', 1, 'Progressione di forza lenta e pesante tollerata (3 sedute a settimana)', 'Sedute forza', 'gte', 3, 'sedute/sett', TRUE),
  ('sys_knee_tendon_p2_c2', 'sys_knee_tendon_p2', 2, 'Forza del quadricipite almeno 80% del controlaterale', 'Quadricipite LSI', 'gte', 80, '%', TRUE),
  ('sys_knee_tendon_p2_c3', 'sys_knee_tendon_p2', 3, 'VISA-P almeno 70', 'VISA-P', 'gte', 70, 'punti', TRUE),
  ('sys_knee_tendon_p2_c4', 'sys_knee_tendon_p2', 4, 'Dolore durante l''esercizio stabilmente entro 3/10', 'VAS durante esercizio', 'lte', 3, '/10', TRUE),
  ('sys_knee_tendon_p3_c1', 'sys_knee_tendon_p3', 1, 'Salti bipodalici e monopodalici senza aumento del dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_tendon_p3_c2', 'sys_knee_tendon_p3', 2, 'Atterraggio controllato, senza valgo dinamico', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_tendon_p3_c3', 'sys_knee_tendon_p3', 3, 'VISA-P almeno 80', 'VISA-P', 'gte', 80, 'punti', TRUE),
  ('sys_knee_tendon_p3_c4', 'sys_knee_tendon_p3', 4, 'Countermovement jump almeno 90% del controlaterale', 'CMJ LSI', 'gte', 90, '%', FALSE),
  ('sys_knee_tendon_p4_c1', 'sys_knee_tendon_p4', 1, 'Allenamento di tiro e rimbalzo a volume pieno senza reazione', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_tendon_p4_c2', 'sys_knee_tendon_p4', 2, 'Nessun peggioramento mattutino dopo le sedute con salti', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_tendon_p4_c3', 'sys_knee_tendon_p4', 3, 'Forza del quadricipite almeno 90%', 'Quadricipite LSI', 'gte', 90, '%', TRUE),
  ('sys_knee_tendon_p5_c1', 'sys_knee_tendon_p5', 1, 'Due allenamenti completi con la squadra senza reazione', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_tendon_p5_c2', 'sys_knee_tendon_p5', 2, 'VISA-P almeno 85', 'VISA-P', 'gte', 85, 'punti', TRUE),
  ('sys_knee_tendon_p5_c3', 'sys_knee_tendon_p5', 3, 'Piano di gestione del carico concordato per le settimane successive', NULL, NULL, NULL, NULL, FALSE),
  ('sys_knee_generic_p1_c1', 'sys_knee_generic_p1', 1, 'Dolore a riposo entro 2/10', 'VAS a riposo', 'lte', 2, '/10', TRUE),
  ('sys_knee_generic_p1_c2', 'sys_knee_generic_p1', 2, 'Versamento assente o minimo', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_generic_p1_c3', 'sys_knee_generic_p1', 3, 'Estensione completa', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_generic_p2_c1', 'sys_knee_generic_p2', 1, 'Flessione attiva almeno 125 gradi', 'Flessione attiva', 'gte', 125, 'gradi', TRUE),
  ('sys_knee_generic_p2_c2', 'sys_knee_generic_p2', 2, 'Forza del quadricipite almeno 75% del controlaterale', 'Quadricipite LSI', 'gte', 75, '%', TRUE),
  ('sys_knee_generic_p2_c3', 'sys_knee_generic_p2', 3, 'Nessun versamento dopo il carico', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_generic_p3_c1', 'sys_knee_generic_p3', 1, 'Corsa lineare 20 minuti senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_generic_p3_c2', 'sys_knee_generic_p3', 2, 'Single leg hop test almeno 85%', 'Single hop LSI', 'gte', 85, '%', TRUE),
  ('sys_knee_generic_p3_c3', 'sys_knee_generic_p3', 3, 'Cambi di direzione progressivi senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_generic_p4_c1', 'sys_knee_generic_p4', 1, 'Forza del quadricipite almeno 90%', 'Quadricipite LSI', 'gte', 90, '%', TRUE),
  ('sys_knee_generic_p4_c2', 'sys_knee_generic_p4', 2, 'Drill tecnici completati al 100% di intensita''', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_generic_p4_c3', 'sys_knee_generic_p4', 3, 'Nessun versamento nelle 24 h successive', NULL, NULL, NULL, NULL, TRUE),
  ('sys_knee_generic_p5_c1', 'sys_knee_generic_p5', 1, 'Due allenamenti completi con contatto senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_knee_generic_p5_c2', 'sys_knee_generic_p5', 2, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_ligament_major_p1_c1', 'sys_ankle_ligament_major_p1', 1, 'Dolore a riposo entro 2/10', 'VAS a riposo', 'lte', 2, '/10', TRUE),
  ('sys_ankle_ligament_major_p1_c2', 'sys_ankle_ligament_major_p1', 2, 'Edema in riduzione, differenza di circonferenza sotto 1 cm', 'Differenza malleolare', 'lte', 1, 'cm', TRUE),
  ('sys_ankle_ligament_major_p1_c3', 'sys_ankle_ligament_major_p1', 3, 'Carico completo senza stampelle e senza zoppia', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_ligament_major_p2_c1', 'sys_ankle_ligament_major_p2', 1, 'Weight bearing lunge test: differenza sotto 2 cm', 'WBLT differenza', 'lte', 2, 'cm', TRUE),
  ('sys_ankle_ligament_major_p2_c2', 'sys_ankle_ligament_major_p2', 2, 'Forza degli eversori almeno 80% del controlaterale', 'Eversori LSI', 'gte', 80, '%', TRUE),
  ('sys_ankle_ligament_major_p2_c3', 'sys_ankle_ligament_major_p2', 3, 'Appoggio monopodalico a occhi chiusi 30 secondi', 'Equilibrio occhi chiusi', 'gte', 30, 'secondi', TRUE),
  ('sys_ankle_ligament_major_p2_c4', 'sys_ankle_ligament_major_p2', 4, 'Salita sulle punte monopodalica: 20 ripetizioni', 'Heel raise', 'gte', 20, 'ripetizioni', TRUE),
  ('sys_ankle_ligament_major_p3_c1', 'sys_ankle_ligament_major_p3', 1, 'Corsa lineare 20 minuti senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_ligament_major_p3_c2', 'sys_ankle_ligament_major_p3', 2, 'Y-Balance arto inferiore: differenza sotto 4 cm', 'Y-Balance ANT', 'lte', 4, 'cm', TRUE),
  ('sys_ankle_ligament_major_p3_c3', 'sys_ankle_ligament_major_p3', 3, 'Single leg hop test almeno 90%', 'Single hop LSI', 'gte', 90, '%', TRUE),
  ('sys_ankle_ligament_major_p3_c4', 'sys_ankle_ligament_major_p3', 4, 'Atterraggio monopodalico controllato', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_ligament_major_p4_c1', 'sys_ankle_ligament_major_p4', 1, 'Cambi di direzione, arresti e scivolamenti a intensita'' piena', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_ligament_major_p4_c2', 'sys_ankle_ligament_major_p4', 2, 'CAIT almeno 24', 'CAIT', 'gte', 24, 'punti', TRUE),
  ('sys_ankle_ligament_major_p4_c3', 'sys_ankle_ligament_major_p4', 3, 'Drill di rimbalzo e contrasto senza apprensione', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_ligament_major_p4_c4', 'sys_ankle_ligament_major_p4', 4, 'Taping o cavigliera concordati per il rientro', NULL, NULL, NULL, NULL, FALSE),
  ('sys_ankle_ligament_major_p5_c1', 'sys_ankle_ligament_major_p5', 1, 'Due allenamenti completi con contatto senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_ankle_ligament_major_p5_c2', 'sys_ankle_ligament_major_p5', 2, 'Nessun gonfiore serale dopo l''allenamento', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_ligament_major_p5_c3', 'sys_ankle_ligament_major_p5', 3, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_ligament_minor_p1_c1', 'sys_ankle_ligament_minor_p1', 1, 'Dolore a riposo entro 2/10', 'VAS a riposo', 'lte', 2, '/10', TRUE),
  ('sys_ankle_ligament_minor_p1_c2', 'sys_ankle_ligament_minor_p1', 2, 'Carico completo senza zoppia', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_ligament_minor_p2_c1', 'sys_ankle_ligament_minor_p2', 1, 'Weight bearing lunge test: differenza sotto 2 cm', 'WBLT differenza', 'lte', 2, 'cm', TRUE),
  ('sys_ankle_ligament_minor_p2_c2', 'sys_ankle_ligament_minor_p2', 2, 'Appoggio monopodalico a occhi chiusi 30 secondi', 'Equilibrio occhi chiusi', 'gte', 30, 'secondi', TRUE),
  ('sys_ankle_ligament_minor_p3_c1', 'sys_ankle_ligament_minor_p3', 1, 'Single leg hop test almeno 90%', 'Single hop LSI', 'gte', 90, '%', TRUE),
  ('sys_ankle_ligament_minor_p3_c2', 'sys_ankle_ligament_minor_p3', 2, 'Cambi di direzione a intensita'' piena senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_ligament_minor_p4_c1', 'sys_ankle_ligament_minor_p4', 1, 'Un allenamento completo senza sintomi', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_ligament_minor_p4_c2', 'sys_ankle_ligament_minor_p4', 2, 'CAIT almeno 24', 'CAIT', 'gte', 24, 'punti', FALSE),
  ('sys_ankle_generic_p1_c1', 'sys_ankle_generic_p1', 1, 'Dolore a riposo entro 2/10', 'VAS a riposo', 'lte', 2, '/10', TRUE),
  ('sys_ankle_generic_p1_c2', 'sys_ankle_generic_p1', 2, 'Carico completo senza zoppia', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_generic_p2_c1', 'sys_ankle_generic_p2', 1, 'Weight bearing lunge test: differenza sotto 2 cm', 'WBLT differenza', 'lte', 2, 'cm', TRUE),
  ('sys_ankle_generic_p2_c2', 'sys_ankle_generic_p2', 2, 'Salita sulle punte monopodalica: 20 ripetizioni', 'Heel raise', 'gte', 20, 'ripetizioni', TRUE),
  ('sys_ankle_generic_p3_c1', 'sys_ankle_generic_p3', 1, 'Corsa lineare 20 minuti senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_generic_p3_c2', 'sys_ankle_generic_p3', 2, 'Single leg hop test almeno 90%', 'Single hop LSI', 'gte', 90, '%', TRUE),
  ('sys_ankle_generic_p4_c1', 'sys_ankle_generic_p4', 1, 'Cambi di direzione e arresti a intensita'' piena', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_generic_p4_c2', 'sys_ankle_generic_p4', 2, 'Drill di squadra completati', NULL, NULL, NULL, NULL, TRUE),
  ('sys_ankle_generic_p5_c1', 'sys_ankle_generic_p5', 1, 'Due allenamenti completi senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_ankle_generic_p5_c2', 'sys_ankle_generic_p5', 2, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_hamstring_muscular_p1_c1', 'sys_hamstring_muscular_p1', 1, 'Cammino senza zoppia', NULL, NULL, NULL, NULL, TRUE),
  ('sys_hamstring_muscular_p1_c2', 'sys_hamstring_muscular_p1', 2, 'Dolore alla palpazione in riduzione', NULL, NULL, NULL, NULL, TRUE),
  ('sys_hamstring_muscular_p1_c3', 'sys_hamstring_muscular_p1', 3, 'Contrazione isometrica submassimale indolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_hamstring_muscular_p2_c1', 'sys_hamstring_muscular_p2', 1, 'Isometrica a 90/90 senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_hamstring_muscular_p2_c2', 'sys_hamstring_muscular_p2', 2, 'Forza isometrica almeno 80% del controlaterale', 'Isometrica LSI', 'gte', 80, '%', TRUE),
  ('sys_hamstring_muscular_p2_c3', 'sys_hamstring_muscular_p2', 3, 'Corsa a intensita'' bassa senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_hamstring_muscular_p2_c4', 'sys_hamstring_muscular_p2', 4, 'Nessun dolore alla palpazione a riposo', NULL, NULL, NULL, NULL, TRUE),
  ('sys_hamstring_muscular_p3_c1', 'sys_hamstring_muscular_p3', 1, 'Nordic hamstring exercise tollerato senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_hamstring_muscular_p3_c2', 'sys_hamstring_muscular_p3', 2, 'Forza eccentrica almeno 90% del controlaterale', 'Eccentrica LSI', 'gte', 90, '%', TRUE),
  ('sys_hamstring_muscular_p3_c3', 'sys_hamstring_muscular_p3', 3, 'Corsa all''80% della velocita'' massimale senza sintomi', 'Velocita'' raggiunta', 'gte', 80, '%', TRUE),
  ('sys_hamstring_muscular_p4_c1', 'sys_hamstring_muscular_p4', 1, 'Askling H-test negativo (nessuna apprensione)', NULL, NULL, NULL, NULL, TRUE),
  ('sys_hamstring_muscular_p4_c2', 'sys_hamstring_muscular_p4', 2, 'Sprint alla velocita'' massimale del pre-infortunio', 'Velocita'' raggiunta', 'gte', 95, '%', TRUE),
  ('sys_hamstring_muscular_p4_c3', 'sys_hamstring_muscular_p4', 3, 'Forza isometrica a lunghezza estesa almeno 95%', 'Isometrica LSI', 'gte', 95, '%', TRUE),
  ('sys_hamstring_muscular_p4_c4', 'sys_hamstring_muscular_p4', 4, 'Contropiede, arresti e ripartenze a intensita'' piena', NULL, NULL, NULL, NULL, TRUE),
  ('sys_hamstring_muscular_p5_c1', 'sys_hamstring_muscular_p5', 1, 'Due allenamenti completi senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_hamstring_muscular_p5_c2', 'sys_hamstring_muscular_p5', 2, 'Nessun dolore alla palpazione dopo l''allenamento', NULL, NULL, NULL, NULL, TRUE),
  ('sys_hamstring_muscular_p5_c3', 'sys_hamstring_muscular_p5', 3, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_calf_muscular_p1_c1', 'sys_calf_muscular_p1', 1, 'Cammino senza zoppia', NULL, NULL, NULL, NULL, TRUE),
  ('sys_calf_muscular_p1_c2', 'sys_calf_muscular_p1', 2, 'Salita bipodalica sulle punte indolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_calf_muscular_p2_c1', 'sys_calf_muscular_p2', 1, 'Salita monopodalica sulle punte: almeno 15 ripetizioni', 'Heel raise', 'gte', 15, 'ripetizioni', TRUE),
  ('sys_calf_muscular_p2_c2', 'sys_calf_muscular_p2', 2, 'Corsa a intensita'' bassa senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_calf_muscular_p2_c3', 'sys_calf_muscular_p2', 3, 'Nessun dolore alla palpazione a riposo', NULL, NULL, NULL, NULL, TRUE),
  ('sys_calf_muscular_p3_c1', 'sys_calf_muscular_p3', 1, 'Salita monopodalica sulle punte: almeno 25 ripetizioni', 'Heel raise', 'gte', 25, 'ripetizioni', TRUE),
  ('sys_calf_muscular_p3_c2', 'sys_calf_muscular_p3', 2, 'Hop test monopodalico almeno 90%', 'Single hop LSI', 'gte', 90, '%', TRUE),
  ('sys_calf_muscular_p3_c3', 'sys_calf_muscular_p3', 3, 'Corsa all''85% della velocita'' massimale senza sintomi', 'Velocita'' raggiunta', 'gte', 85, '%', TRUE),
  ('sys_calf_muscular_p4_c1', 'sys_calf_muscular_p4', 1, 'Sprint, arresti e cambi di direzione a intensita'' piena', NULL, NULL, NULL, NULL, TRUE),
  ('sys_calf_muscular_p4_c2', 'sys_calf_muscular_p4', 2, 'Volume di salti da allenamento tollerato', NULL, NULL, NULL, NULL, TRUE),
  ('sys_calf_muscular_p5_c1', 'sys_calf_muscular_p5', 1, 'Due allenamenti completi senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_calf_muscular_p5_c2', 'sys_calf_muscular_p5', 2, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_quadriceps_muscular_p1_c1', 'sys_quadriceps_muscular_p1', 1, 'Cammino senza zoppia', NULL, NULL, NULL, NULL, TRUE),
  ('sys_quadriceps_muscular_p1_c2', 'sys_quadriceps_muscular_p1', 2, 'Contrazione isometrica submassimale indolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_quadriceps_muscular_p1_c3', 'sys_quadriceps_muscular_p1', 3, 'Flessione passiva del ginocchio in progressione', NULL, NULL, NULL, NULL, TRUE),
  ('sys_quadriceps_muscular_p2_c1', 'sys_quadriceps_muscular_p2', 1, 'Forza isometrica almeno 80% del controlaterale', 'Quadricipite LSI', 'gte', 80, '%', TRUE),
  ('sys_quadriceps_muscular_p2_c2', 'sys_quadriceps_muscular_p2', 2, 'Squat monopodalico controllato senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_quadriceps_muscular_p2_c3', 'sys_quadriceps_muscular_p2', 3, 'Corsa a intensita'' bassa senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_quadriceps_muscular_p3_c1', 'sys_quadriceps_muscular_p3', 1, 'Forza almeno 90% del controlaterale', 'Quadricipite LSI', 'gte', 90, '%', TRUE),
  ('sys_quadriceps_muscular_p3_c2', 'sys_quadriceps_muscular_p3', 2, 'Test di allungamento (Ely) senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_quadriceps_muscular_p3_c3', 'sys_quadriceps_muscular_p3', 3, 'Salti e atterraggi controllati senza sintomi', NULL, NULL, NULL, NULL, TRUE),
  ('sys_quadriceps_muscular_p4_c1', 'sys_quadriceps_muscular_p4', 1, 'Sprint a intensita'' piena senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_quadriceps_muscular_p4_c2', 'sys_quadriceps_muscular_p4', 2, 'Drill tecnici e difensivi completati', NULL, NULL, NULL, NULL, TRUE),
  ('sys_quadriceps_muscular_p5_c1', 'sys_quadriceps_muscular_p5', 1, 'Due allenamenti completi senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_quadriceps_muscular_p5_c2', 'sys_quadriceps_muscular_p5', 2, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_groin_any_p1_c1', 'sys_groin_any_p1', 1, 'Cammino senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_groin_any_p1_c2', 'sys_groin_any_p1', 2, 'Squeeze test submassimale tollerato', NULL, NULL, NULL, NULL, TRUE),
  ('sys_groin_any_p2_c1', 'sys_groin_any_p2', 1, 'Squeeze test a 45 gradi almeno 75% del valore atteso', 'Squeeze test', 'gte', 75, '%', TRUE),
  ('sys_groin_any_p2_c2', 'sys_groin_any_p2', 2, 'Corsa lineare senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_groin_any_p2_c3', 'sys_groin_any_p2', 3, 'Nessun dolore inguinale al risveglio', NULL, NULL, NULL, NULL, TRUE),
  ('sys_groin_any_p3_c1', 'sys_groin_any_p3', 1, 'Copenhagen adduction tollerato per 3 serie', 'Copenhagen', 'gte', 3, 'serie', TRUE),
  ('sys_groin_any_p3_c2', 'sys_groin_any_p3', 2, 'Squeeze test almeno 90%', 'Squeeze test', 'gte', 90, '%', TRUE),
  ('sys_groin_any_p3_c3', 'sys_groin_any_p3', 3, 'Cambi di direzione a intensita'' progressiva senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_groin_any_p4_c1', 'sys_groin_any_p4', 1, 'Scivolamenti difensivi e arresti a intensita'' piena', NULL, NULL, NULL, NULL, TRUE),
  ('sys_groin_any_p4_c2', 'sys_groin_any_p4', 2, 'Nessun dolore nelle 24 h successive alle sedute intense', NULL, NULL, NULL, NULL, TRUE),
  ('sys_groin_any_p4_c3', 'sys_groin_any_p4', 3, 'HAGOS sport almeno 80', 'HAGOS sport', 'gte', 80, 'punti', FALSE),
  ('sys_groin_any_p5_c1', 'sys_groin_any_p5', 1, 'Due allenamenti completi senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_groin_any_p5_c2', 'sys_groin_any_p5', 2, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_lower_limb_muscular_p1_c1', 'sys_lower_limb_muscular_p1', 1, 'Cammino senza zoppia', NULL, NULL, NULL, NULL, TRUE),
  ('sys_lower_limb_muscular_p1_c2', 'sys_lower_limb_muscular_p1', 2, 'Contrazione isometrica submassimale indolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_lower_limb_muscular_p2_c1', 'sys_lower_limb_muscular_p2', 1, 'Forza isometrica almeno 80% del controlaterale', 'Forza LSI', 'gte', 80, '%', TRUE),
  ('sys_lower_limb_muscular_p2_c2', 'sys_lower_limb_muscular_p2', 2, 'Corsa a intensita'' bassa senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_lower_limb_muscular_p3_c1', 'sys_lower_limb_muscular_p3', 1, 'Forza almeno 90% del controlaterale', 'Forza LSI', 'gte', 90, '%', TRUE),
  ('sys_lower_limb_muscular_p3_c2', 'sys_lower_limb_muscular_p3', 2, 'Corsa all''85% della velocita'' massimale senza sintomi', 'Velocita'' raggiunta', 'gte', 85, '%', TRUE),
  ('sys_lower_limb_muscular_p4_c1', 'sys_lower_limb_muscular_p4', 1, 'Cambi di direzione, arresti e salti a intensita'' piena', NULL, NULL, NULL, NULL, TRUE),
  ('sys_lower_limb_muscular_p4_c2', 'sys_lower_limb_muscular_p4', 2, 'Drill di squadra completati', NULL, NULL, NULL, NULL, TRUE),
  ('sys_lower_limb_muscular_p5_c1', 'sys_lower_limb_muscular_p5', 1, 'Due allenamenti completi senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_lower_limb_muscular_p5_c2', 'sys_lower_limb_muscular_p5', 2, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_instability_p1_c1', 'sys_shoulder_instability_p1', 1, 'Dolore a riposo entro 2/10', 'VAS a riposo', 'lte', 2, '/10', TRUE),
  ('sys_shoulder_instability_p1_c2', 'sys_shoulder_instability_p1', 2, 'ROM passivo entro i limiti indicati dal medico, senza apprensione', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_instability_p1_c3', 'sys_shoulder_instability_p1', 3, 'Controllo scapolare in posizione neutra', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_instability_p1_c4', 'sys_shoulder_instability_p1', 4, 'Nessun deficit neurologico all''arto', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_instability_p2_c1', 'sys_shoulder_instability_p2', 1, 'ROM attivo completo e simmetrico al controlaterale', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_instability_p2_c2', 'sys_shoulder_instability_p2', 2, 'Extrarotazione: forza almeno 70% del controlaterale', 'Extrarotatori LSI', 'gte', 70, '%', TRUE),
  ('sys_shoulder_instability_p2_c3', 'sys_shoulder_instability_p2', 3, 'Rapporto extrarotatori/intrarotatori almeno 0.65', 'ER/IR ratio', 'gte', 0.65, 'rapporto', TRUE),
  ('sys_shoulder_instability_p2_c4', 'sys_shoulder_instability_p2', 4, 'Nessun dolore notturno', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_instability_p3_c1', 'sys_shoulder_instability_p3', 1, 'Extrarotazione: forza almeno 85% del controlaterale', 'Extrarotatori LSI', 'gte', 85, '%', TRUE),
  ('sys_shoulder_instability_p3_c2', 'sys_shoulder_instability_p3', 2, 'CKCUEST almeno 21 tocchi', 'CKCUEST', 'gte', 21, 'tocchi', TRUE),
  ('sys_shoulder_instability_p3_c3', 'sys_shoulder_instability_p3', 3, 'Y-Balance arto superiore: differenza sotto 4 cm', 'Y-Balance UQ', 'lte', 4, 'cm', FALSE),
  ('sys_shoulder_instability_p3_c4', 'sys_shoulder_instability_p3', 4, 'Lavoro sopra la testa senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_instability_p4_c1', 'sys_shoulder_instability_p4', 1, 'Test di apprensione negativo', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_instability_p4_c2', 'sys_shoulder_instability_p4', 2, 'Extrarotazione: forza almeno 90% del controlaterale', 'Extrarotatori LSI', 'gte', 90, '%', TRUE),
  ('sys_shoulder_instability_p4_c3', 'sys_shoulder_instability_p4', 3, 'Passaggi e tiri a distanza e intensita'' di gara senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_instability_p4_c4', 'sys_shoulder_instability_p4', 4, 'Cadute e appoggi controllati sul tappetino', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_instability_p5_c1', 'sys_shoulder_instability_p5', 1, 'Contrasti e lotta a rimbalzo senza apprensione', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_instability_p5_c2', 'sys_shoulder_instability_p5', 2, 'Due allenamenti completi con contatto senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_shoulder_instability_p5_c3', 'sys_shoulder_instability_p5', 3, 'Clearance medica firmata', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_tendon_p1_c1', 'sys_shoulder_tendon_p1', 1, 'Dolore notturno assente', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_tendon_p1_c2', 'sys_shoulder_tendon_p1', 2, 'Dolore durante l''esercizio entro 3/10', 'VAS durante esercizio', 'lte', 3, '/10', TRUE),
  ('sys_shoulder_tendon_p1_c3', 'sys_shoulder_tendon_p1', 3, 'ROM attivo mantenuto, lavoro sopra la testa sospeso', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_tendon_p2_c1', 'sys_shoulder_tendon_p2', 1, 'Isometrie di extrarotazione tollerate a carico progressivo', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_tendon_p2_c2', 'sys_shoulder_tendon_p2', 2, 'Controllo scapolare corretto nei movimenti sopra la testa', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_tendon_p2_c3', 'sys_shoulder_tendon_p2', 3, 'Extrarotazione: forza almeno 80% del controlaterale', 'Extrarotatori LSI', 'gte', 80, '%', TRUE),
  ('sys_shoulder_tendon_p3_c1', 'sys_shoulder_tendon_p3', 1, 'Extrarotazione: forza almeno 90% del controlaterale', 'Extrarotatori LSI', 'gte', 90, '%', TRUE),
  ('sys_shoulder_tendon_p3_c2', 'sys_shoulder_tendon_p3', 2, 'Rapporto extrarotatori/intrarotatori almeno 0.68', 'ER/IR ratio', 'gte', 0.68, 'rapporto', TRUE),
  ('sys_shoulder_tendon_p3_c3', 'sys_shoulder_tendon_p3', 3, 'CKCUEST almeno 21 tocchi', 'CKCUEST', 'gte', 21, 'tocchi', FALSE),
  ('sys_shoulder_tendon_p4_c1', 'sys_shoulder_tendon_p4', 1, 'Volume di tiro da allenamento senza reazione il giorno dopo', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_tendon_p4_c2', 'sys_shoulder_tendon_p4', 2, 'Passaggi lunghi a intensita'' piena senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_tendon_p5_c1', 'sys_shoulder_tendon_p5', 1, 'Due allenamenti completi senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_shoulder_tendon_p5_c2', 'sys_shoulder_tendon_p5', 2, 'Piano di gestione del volume di tiro concordato', NULL, NULL, NULL, NULL, FALSE),
  ('sys_shoulder_generic_p1_c1', 'sys_shoulder_generic_p1', 1, 'Guarigione o consolidazione documentata dal medico (se frattura o lesione strutturale)', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_generic_p1_c2', 'sys_shoulder_generic_p1', 2, 'Dolore a riposo entro 2/10', 'VAS a riposo', 'lte', 2, '/10', TRUE),
  ('sys_shoulder_generic_p1_c3', 'sys_shoulder_generic_p1', 3, 'Nessun dolore notturno', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_generic_p2_c1', 'sys_shoulder_generic_p2', 1, 'ROM attivo completo e simmetrico', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_generic_p2_c2', 'sys_shoulder_generic_p2', 2, 'Extrarotazione: forza almeno 80% del controlaterale', 'Extrarotatori LSI', 'gte', 80, '%', TRUE),
  ('sys_shoulder_generic_p2_c3', 'sys_shoulder_generic_p2', 3, 'Controllo scapolare corretto', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_generic_p3_c1', 'sys_shoulder_generic_p3', 1, 'Extrarotazione: forza almeno 90% del controlaterale', 'Extrarotatori LSI', 'gte', 90, '%', TRUE),
  ('sys_shoulder_generic_p3_c2', 'sys_shoulder_generic_p3', 2, 'CKCUEST almeno 21 tocchi', 'CKCUEST', 'gte', 21, 'tocchi', TRUE),
  ('sys_shoulder_generic_p4_c1', 'sys_shoulder_generic_p4', 1, 'Tiri e passaggi a intensita'' di gara senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_generic_p4_c2', 'sys_shoulder_generic_p4', 2, 'Contrasti e appoggi controllati', NULL, NULL, NULL, NULL, TRUE),
  ('sys_shoulder_generic_p5_c1', 'sys_shoulder_generic_p5', 1, 'Due allenamenti completi con contatto senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_shoulder_generic_p5_c2', 'sys_shoulder_generic_p5', 2, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_upper_limb_bone_p1_c1', 'sys_upper_limb_bone_p1', 1, 'Consolidazione documentata dal controllo radiografico', NULL, NULL, NULL, NULL, TRUE),
  ('sys_upper_limb_bone_p1_c2', 'sys_upper_limb_bone_p1', 2, 'Immobilizzazione rispettata per il tempo indicato', NULL, NULL, NULL, NULL, TRUE),
  ('sys_upper_limb_bone_p1_c3', 'sys_upper_limb_bone_p1', 3, 'Nessun dolore alla palpazione della sede', NULL, NULL, NULL, NULL, TRUE),
  ('sys_upper_limb_bone_p1_c4', 'sys_upper_limb_bone_p1', 4, 'Lavoro cardiovascolare e di arto inferiore mantenuto in questa fase', NULL, NULL, NULL, NULL, FALSE),
  ('sys_upper_limb_bone_p2_c1', 'sys_upper_limb_bone_p2', 1, 'ROM attivo completo e simmetrico', NULL, NULL, NULL, NULL, TRUE),
  ('sys_upper_limb_bone_p2_c2', 'sys_upper_limb_bone_p2', 2, 'Forza di presa almeno 80% del controlaterale', 'Hand grip LSI', 'gte', 80, '%', TRUE),
  ('sys_upper_limb_bone_p2_c3', 'sys_upper_limb_bone_p2', 3, 'Nessun dolore nelle attivita'' quotidiane', NULL, NULL, NULL, NULL, TRUE),
  ('sys_upper_limb_bone_p3_c1', 'sys_upper_limb_bone_p3', 1, 'Forza di presa almeno 90% del controlaterale', 'Hand grip LSI', 'gte', 90, '%', TRUE),
  ('sys_upper_limb_bone_p3_c2', 'sys_upper_limb_bone_p3', 2, 'Palleggio, presa e passaggio senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_upper_limb_bone_p3_c3', 'sys_upper_limb_bone_p3', 3, 'Tiro a distanza di gara senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_upper_limb_bone_p3_c4', 'sys_upper_limb_bone_p3', 4, 'Appoggio in carico sull''arto (push-up) tollerato', NULL, NULL, NULL, NULL, TRUE),
  ('sys_upper_limb_bone_p4_c1', 'sys_upper_limb_bone_p4', 1, 'Contrasti e lotta a rimbalzo senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_upper_limb_bone_p4_c2', 'sys_upper_limb_bone_p4', 2, 'Due allenamenti completi con contatto senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_upper_limb_bone_p4_c3', 'sys_upper_limb_bone_p4', 3, 'Tutore o taping di protezione concordato per il rientro', NULL, NULL, NULL, NULL, FALSE),
  ('sys_upper_limb_bone_p4_c4', 'sys_upper_limb_bone_p4', 4, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_spine_generic_p1_c1', 'sys_spine_generic_p1', 1, 'Nessun deficit neurologico (forza, sensibilita'', riflessi)', NULL, NULL, NULL, NULL, TRUE),
  ('sys_spine_generic_p1_c2', 'sys_spine_generic_p1', 2, 'Guarigione o consolidazione documentata dal medico (se lesione ossea)', NULL, NULL, NULL, NULL, TRUE),
  ('sys_spine_generic_p1_c3', 'sys_spine_generic_p1', 3, 'Dolore a riposo entro 3/10', 'VAS a riposo', 'lte', 3, '/10', TRUE),
  ('sys_spine_generic_p1_c4', 'sys_spine_generic_p1', 4, 'Cammino e attivita'' quotidiane senza dolore irradiato', NULL, NULL, NULL, NULL, TRUE),
  ('sys_spine_generic_p2_c1', 'sys_spine_generic_p2', 1, 'Plank frontale 60 secondi con tecnica corretta', 'Plank', 'gte', 60, 'secondi', TRUE),
  ('sys_spine_generic_p2_c2', 'sys_spine_generic_p2', 2, 'Side plank 45 secondi per lato', 'Side plank', 'gte', 45, 'secondi', TRUE),
  ('sys_spine_generic_p2_c3', 'sys_spine_generic_p2', 3, 'ROM lombare funzionale senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_spine_generic_p3_c1', 'sys_spine_generic_p3', 1, 'Squat e stacco a carico progressivo con tecnica corretta', NULL, NULL, NULL, NULL, TRUE),
  ('sys_spine_generic_p3_c2', 'sys_spine_generic_p3', 2, 'Corsa 20 minuti senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_spine_generic_p3_c3', 'sys_spine_generic_p3', 3, 'Biering-Sorensen almeno 90 secondi', 'Biering-Sorensen', 'gte', 90, 'secondi', FALSE),
  ('sys_spine_generic_p4_c1', 'sys_spine_generic_p4', 1, 'Salti, atterraggi e rotazioni a intensita'' piena senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_spine_generic_p4_c2', 'sys_spine_generic_p4', 2, 'Drill difensivi e cambi di direzione completati', NULL, NULL, NULL, NULL, TRUE),
  ('sys_spine_generic_p4_c3', 'sys_spine_generic_p4', 3, 'Nessuna recrudescenza nelle 24 h successive', NULL, NULL, NULL, NULL, TRUE),
  ('sys_spine_generic_p5_c1', 'sys_spine_generic_p5', 1, 'Due allenamenti completi con contatto senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_spine_generic_p5_c2', 'sys_spine_generic_p5', 2, 'Clearance medica', NULL, NULL, NULL, NULL, TRUE),
  ('sys_bone_generic_p1_c1', 'sys_bone_generic_p1', 1, 'Consolidazione documentata dal controllo radiografico', NULL, NULL, NULL, NULL, TRUE),
  ('sys_bone_generic_p1_c2', 'sys_bone_generic_p1', 2, 'Nessun dolore alla palpazione della sede', NULL, NULL, NULL, NULL, TRUE),
  ('sys_bone_generic_p1_c3', 'sys_bone_generic_p1', 3, 'Carico progressivo autorizzato dal medico', NULL, NULL, NULL, NULL, TRUE),
  ('sys_bone_generic_p2_c1', 'sys_bone_generic_p2', 1, 'ROM attivo completo e simmetrico', NULL, NULL, NULL, NULL, TRUE),
  ('sys_bone_generic_p2_c2', 'sys_bone_generic_p2', 2, 'Forza almeno 80% del controlaterale', 'Forza LSI', 'gte', 80, '%', TRUE),
  ('sys_bone_generic_p3_c1', 'sys_bone_generic_p3', 1, 'Forza almeno 90% del controlaterale', 'Forza LSI', 'gte', 90, '%', TRUE),
  ('sys_bone_generic_p3_c2', 'sys_bone_generic_p3', 2, 'Corsa e salti senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_bone_generic_p3_c3', 'sys_bone_generic_p3', 3, 'Drill tecnici completati al 100% di intensita''', NULL, NULL, NULL, NULL, TRUE),
  ('sys_bone_generic_p4_c1', 'sys_bone_generic_p4', 1, 'Due allenamenti completi con contatto senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_bone_generic_p4_c2', 'sys_bone_generic_p4', 2, 'Clearance medica firmata', NULL, NULL, NULL, NULL, TRUE),
  ('sys_default_generic_p1_c1', 'sys_default_generic_p1', 1, 'Dolore a riposo entro 2/10', 'VAS a riposo', 'lte', 2, '/10', TRUE),
  ('sys_default_generic_p1_c2', 'sys_default_generic_p1', 2, 'Nessun segno di infiammazione acuta', NULL, NULL, NULL, NULL, TRUE),
  ('sys_default_generic_p1_c3', 'sys_default_generic_p1', 3, 'ROM passivo recuperato oltre il 70%', 'ROM passivo', 'gte', 70, '%', TRUE),
  ('sys_default_generic_p2_c1', 'sys_default_generic_p2', 1, 'Dolore nelle attivita'' quotidiane entro 2/10', 'VAS quotidiano', 'lte', 2, '/10', TRUE),
  ('sys_default_generic_p2_c2', 'sys_default_generic_p2', 2, 'ROM attivo completo e simmetrico', NULL, NULL, NULL, NULL, TRUE),
  ('sys_default_generic_p2_c3', 'sys_default_generic_p2', 3, 'Forza isometrica almeno 70% del controlaterale', 'Forza LSI', 'gte', 70, '%', TRUE),
  ('sys_default_generic_p3_c1', 'sys_default_generic_p3', 1, 'Forza almeno 80% del controlaterale', 'Forza LSI', 'gte', 80, '%', TRUE),
  ('sys_default_generic_p3_c2', 'sys_default_generic_p3', 2, 'Corsa con cambi di direzione senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_default_generic_p3_c3', 'sys_default_generic_p3', 3, 'Drill di basket non-contatto completati', NULL, NULL, NULL, NULL, TRUE),
  ('sys_default_generic_p4_c1', 'sys_default_generic_p4', 1, 'Forza almeno 90% del controlaterale', 'Forza LSI', 'gte', 90, '%', TRUE),
  ('sys_default_generic_p4_c2', 'sys_default_generic_p4', 2, 'Allenamento con contatto limitato senza dolore', NULL, NULL, NULL, NULL, TRUE),
  ('sys_default_generic_p4_c3', 'sys_default_generic_p4', 3, 'Drill sport-specifici al 100% di intensita''', NULL, NULL, NULL, NULL, TRUE),
  ('sys_default_generic_p5_c1', 'sys_default_generic_p5', 1, 'Due allenamenti completi con la squadra senza sintomi', 'Sedute complete', 'gte', 2, 'sedute', TRUE),
  ('sys_default_generic_p5_c2', 'sys_default_generic_p5', 2, 'Nessuna reazione nelle 24 h successive', NULL, NULL, NULL, NULL, TRUE),
  ('sys_default_generic_p5_c3', 'sys_default_generic_p5', 3, 'Clearance medica firmata', NULL, NULL, NULL, NULL, TRUE)
ON CONFLICT (id) DO UPDATE SET
  "order" = EXCLUDED."order", description = EXCLUDED.description,
  "testCode" = EXCLUDED."testCode", comparator = EXCLUDED.comparator,
  "targetValue" = EXCLUDED."targetValue", unit = EXCLUDED.unit,
  mandatory = EXCLUDED.mandatory;

-- Righe di sistema non piu' previste dalla libreria: via, cosi' una ri-esecuzione
-- lascia esattamente i template della libreria e nient'altro.
DELETE FROM rtp_template_criteria c
  USING rtp_template_phases p, rtp_templates t
  WHERE c."phaseId" = p.id AND p."templateId" = t.id AND t."isSystem" AND c.id NOT IN ('sys_knee_ligament_major_p1_c1', 'sys_knee_ligament_major_p1_c2', 'sys_knee_ligament_major_p1_c3', 'sys_knee_ligament_major_p1_c4', 'sys_knee_ligament_major_p1_c5', 'sys_knee_ligament_major_p2_c1', 'sys_knee_ligament_major_p2_c2', 'sys_knee_ligament_major_p2_c3', 'sys_knee_ligament_major_p2_c4', 'sys_knee_ligament_major_p2_c5', 'sys_knee_ligament_major_p3_c1', 'sys_knee_ligament_major_p3_c2', 'sys_knee_ligament_major_p3_c3', 'sys_knee_ligament_major_p3_c4', 'sys_knee_ligament_major_p3_c5', 'sys_knee_ligament_major_p4_c1', 'sys_knee_ligament_major_p4_c2', 'sys_knee_ligament_major_p4_c3', 'sys_knee_ligament_major_p4_c4', 'sys_knee_ligament_major_p4_c5', 'sys_knee_ligament_major_p5_c1', 'sys_knee_ligament_major_p5_c2', 'sys_knee_ligament_major_p5_c3', 'sys_knee_ligament_major_p5_c4', 'sys_knee_ligament_major_p6_c1', 'sys_knee_ligament_major_p6_c2', 'sys_knee_ligament_major_p6_c3', 'sys_knee_ligament_major_p6_c4', 'sys_knee_ligament_minor_p1_c1', 'sys_knee_ligament_minor_p1_c2', 'sys_knee_ligament_minor_p1_c3', 'sys_knee_ligament_minor_p2_c1', 'sys_knee_ligament_minor_p2_c2', 'sys_knee_ligament_minor_p2_c3', 'sys_knee_ligament_minor_p3_c1', 'sys_knee_ligament_minor_p3_c2', 'sys_knee_ligament_minor_p3_c3', 'sys_knee_ligament_minor_p4_c1', 'sys_knee_ligament_minor_p4_c2', 'sys_knee_ligament_minor_p4_c3', 'sys_knee_tendon_p1_c1', 'sys_knee_tendon_p1_c2', 'sys_knee_tendon_p1_c3', 'sys_knee_tendon_p1_c4', 'sys_knee_tendon_p2_c1', 'sys_knee_tendon_p2_c2', 'sys_knee_tendon_p2_c3', 'sys_knee_tendon_p2_c4', 'sys_knee_tendon_p3_c1', 'sys_knee_tendon_p3_c2', 'sys_knee_tendon_p3_c3', 'sys_knee_tendon_p3_c4', 'sys_knee_tendon_p4_c1', 'sys_knee_tendon_p4_c2', 'sys_knee_tendon_p4_c3', 'sys_knee_tendon_p5_c1', 'sys_knee_tendon_p5_c2', 'sys_knee_tendon_p5_c3', 'sys_knee_generic_p1_c1', 'sys_knee_generic_p1_c2', 'sys_knee_generic_p1_c3', 'sys_knee_generic_p2_c1', 'sys_knee_generic_p2_c2', 'sys_knee_generic_p2_c3', 'sys_knee_generic_p3_c1', 'sys_knee_generic_p3_c2', 'sys_knee_generic_p3_c3', 'sys_knee_generic_p4_c1', 'sys_knee_generic_p4_c2', 'sys_knee_generic_p4_c3', 'sys_knee_generic_p5_c1', 'sys_knee_generic_p5_c2', 'sys_ankle_ligament_major_p1_c1', 'sys_ankle_ligament_major_p1_c2', 'sys_ankle_ligament_major_p1_c3', 'sys_ankle_ligament_major_p2_c1', 'sys_ankle_ligament_major_p2_c2', 'sys_ankle_ligament_major_p2_c3', 'sys_ankle_ligament_major_p2_c4', 'sys_ankle_ligament_major_p3_c1', 'sys_ankle_ligament_major_p3_c2', 'sys_ankle_ligament_major_p3_c3', 'sys_ankle_ligament_major_p3_c4', 'sys_ankle_ligament_major_p4_c1', 'sys_ankle_ligament_major_p4_c2', 'sys_ankle_ligament_major_p4_c3', 'sys_ankle_ligament_major_p4_c4', 'sys_ankle_ligament_major_p5_c1', 'sys_ankle_ligament_major_p5_c2', 'sys_ankle_ligament_major_p5_c3', 'sys_ankle_ligament_minor_p1_c1', 'sys_ankle_ligament_minor_p1_c2', 'sys_ankle_ligament_minor_p2_c1', 'sys_ankle_ligament_minor_p2_c2', 'sys_ankle_ligament_minor_p3_c1', 'sys_ankle_ligament_minor_p3_c2', 'sys_ankle_ligament_minor_p4_c1', 'sys_ankle_ligament_minor_p4_c2', 'sys_ankle_generic_p1_c1', 'sys_ankle_generic_p1_c2', 'sys_ankle_generic_p2_c1', 'sys_ankle_generic_p2_c2', 'sys_ankle_generic_p3_c1', 'sys_ankle_generic_p3_c2', 'sys_ankle_generic_p4_c1', 'sys_ankle_generic_p4_c2', 'sys_ankle_generic_p5_c1', 'sys_ankle_generic_p5_c2', 'sys_hamstring_muscular_p1_c1', 'sys_hamstring_muscular_p1_c2', 'sys_hamstring_muscular_p1_c3', 'sys_hamstring_muscular_p2_c1', 'sys_hamstring_muscular_p2_c2', 'sys_hamstring_muscular_p2_c3', 'sys_hamstring_muscular_p2_c4', 'sys_hamstring_muscular_p3_c1', 'sys_hamstring_muscular_p3_c2', 'sys_hamstring_muscular_p3_c3', 'sys_hamstring_muscular_p4_c1', 'sys_hamstring_muscular_p4_c2', 'sys_hamstring_muscular_p4_c3', 'sys_hamstring_muscular_p4_c4', 'sys_hamstring_muscular_p5_c1', 'sys_hamstring_muscular_p5_c2', 'sys_hamstring_muscular_p5_c3', 'sys_calf_muscular_p1_c1', 'sys_calf_muscular_p1_c2', 'sys_calf_muscular_p2_c1', 'sys_calf_muscular_p2_c2', 'sys_calf_muscular_p2_c3', 'sys_calf_muscular_p3_c1', 'sys_calf_muscular_p3_c2', 'sys_calf_muscular_p3_c3', 'sys_calf_muscular_p4_c1', 'sys_calf_muscular_p4_c2', 'sys_calf_muscular_p5_c1', 'sys_calf_muscular_p5_c2', 'sys_quadriceps_muscular_p1_c1', 'sys_quadriceps_muscular_p1_c2', 'sys_quadriceps_muscular_p1_c3', 'sys_quadriceps_muscular_p2_c1', 'sys_quadriceps_muscular_p2_c2', 'sys_quadriceps_muscular_p2_c3', 'sys_quadriceps_muscular_p3_c1', 'sys_quadriceps_muscular_p3_c2', 'sys_quadriceps_muscular_p3_c3', 'sys_quadriceps_muscular_p4_c1', 'sys_quadriceps_muscular_p4_c2', 'sys_quadriceps_muscular_p5_c1', 'sys_quadriceps_muscular_p5_c2', 'sys_groin_any_p1_c1', 'sys_groin_any_p1_c2', 'sys_groin_any_p2_c1', 'sys_groin_any_p2_c2', 'sys_groin_any_p2_c3', 'sys_groin_any_p3_c1', 'sys_groin_any_p3_c2', 'sys_groin_any_p3_c3', 'sys_groin_any_p4_c1', 'sys_groin_any_p4_c2', 'sys_groin_any_p4_c3', 'sys_groin_any_p5_c1', 'sys_groin_any_p5_c2', 'sys_lower_limb_muscular_p1_c1', 'sys_lower_limb_muscular_p1_c2', 'sys_lower_limb_muscular_p2_c1', 'sys_lower_limb_muscular_p2_c2', 'sys_lower_limb_muscular_p3_c1', 'sys_lower_limb_muscular_p3_c2', 'sys_lower_limb_muscular_p4_c1', 'sys_lower_limb_muscular_p4_c2', 'sys_lower_limb_muscular_p5_c1', 'sys_lower_limb_muscular_p5_c2', 'sys_shoulder_instability_p1_c1', 'sys_shoulder_instability_p1_c2', 'sys_shoulder_instability_p1_c3', 'sys_shoulder_instability_p1_c4', 'sys_shoulder_instability_p2_c1', 'sys_shoulder_instability_p2_c2', 'sys_shoulder_instability_p2_c3', 'sys_shoulder_instability_p2_c4', 'sys_shoulder_instability_p3_c1', 'sys_shoulder_instability_p3_c2', 'sys_shoulder_instability_p3_c3', 'sys_shoulder_instability_p3_c4', 'sys_shoulder_instability_p4_c1', 'sys_shoulder_instability_p4_c2', 'sys_shoulder_instability_p4_c3', 'sys_shoulder_instability_p4_c4', 'sys_shoulder_instability_p5_c1', 'sys_shoulder_instability_p5_c2', 'sys_shoulder_instability_p5_c3', 'sys_shoulder_tendon_p1_c1', 'sys_shoulder_tendon_p1_c2', 'sys_shoulder_tendon_p1_c3', 'sys_shoulder_tendon_p2_c1', 'sys_shoulder_tendon_p2_c2', 'sys_shoulder_tendon_p2_c3', 'sys_shoulder_tendon_p3_c1', 'sys_shoulder_tendon_p3_c2', 'sys_shoulder_tendon_p3_c3', 'sys_shoulder_tendon_p4_c1', 'sys_shoulder_tendon_p4_c2', 'sys_shoulder_tendon_p5_c1', 'sys_shoulder_tendon_p5_c2', 'sys_shoulder_generic_p1_c1', 'sys_shoulder_generic_p1_c2', 'sys_shoulder_generic_p1_c3', 'sys_shoulder_generic_p2_c1', 'sys_shoulder_generic_p2_c2', 'sys_shoulder_generic_p2_c3', 'sys_shoulder_generic_p3_c1', 'sys_shoulder_generic_p3_c2', 'sys_shoulder_generic_p4_c1', 'sys_shoulder_generic_p4_c2', 'sys_shoulder_generic_p5_c1', 'sys_shoulder_generic_p5_c2', 'sys_upper_limb_bone_p1_c1', 'sys_upper_limb_bone_p1_c2', 'sys_upper_limb_bone_p1_c3', 'sys_upper_limb_bone_p1_c4', 'sys_upper_limb_bone_p2_c1', 'sys_upper_limb_bone_p2_c2', 'sys_upper_limb_bone_p2_c3', 'sys_upper_limb_bone_p3_c1', 'sys_upper_limb_bone_p3_c2', 'sys_upper_limb_bone_p3_c3', 'sys_upper_limb_bone_p3_c4', 'sys_upper_limb_bone_p4_c1', 'sys_upper_limb_bone_p4_c2', 'sys_upper_limb_bone_p4_c3', 'sys_upper_limb_bone_p4_c4', 'sys_spine_generic_p1_c1', 'sys_spine_generic_p1_c2', 'sys_spine_generic_p1_c3', 'sys_spine_generic_p1_c4', 'sys_spine_generic_p2_c1', 'sys_spine_generic_p2_c2', 'sys_spine_generic_p2_c3', 'sys_spine_generic_p3_c1', 'sys_spine_generic_p3_c2', 'sys_spine_generic_p3_c3', 'sys_spine_generic_p4_c1', 'sys_spine_generic_p4_c2', 'sys_spine_generic_p4_c3', 'sys_spine_generic_p5_c1', 'sys_spine_generic_p5_c2', 'sys_bone_generic_p1_c1', 'sys_bone_generic_p1_c2', 'sys_bone_generic_p1_c3', 'sys_bone_generic_p2_c1', 'sys_bone_generic_p2_c2', 'sys_bone_generic_p3_c1', 'sys_bone_generic_p3_c2', 'sys_bone_generic_p3_c3', 'sys_bone_generic_p4_c1', 'sys_bone_generic_p4_c2', 'sys_default_generic_p1_c1', 'sys_default_generic_p1_c2', 'sys_default_generic_p1_c3', 'sys_default_generic_p2_c1', 'sys_default_generic_p2_c2', 'sys_default_generic_p2_c3', 'sys_default_generic_p3_c1', 'sys_default_generic_p3_c2', 'sys_default_generic_p3_c3', 'sys_default_generic_p4_c1', 'sys_default_generic_p4_c2', 'sys_default_generic_p4_c3', 'sys_default_generic_p5_c1', 'sys_default_generic_p5_c2', 'sys_default_generic_p5_c3');
DELETE FROM rtp_template_phases p
  USING rtp_templates t
  WHERE p."templateId" = t.id AND t."isSystem" AND p.id NOT IN ('sys_knee_ligament_major_p1', 'sys_knee_ligament_major_p2', 'sys_knee_ligament_major_p3', 'sys_knee_ligament_major_p4', 'sys_knee_ligament_major_p5', 'sys_knee_ligament_major_p6', 'sys_knee_ligament_minor_p1', 'sys_knee_ligament_minor_p2', 'sys_knee_ligament_minor_p3', 'sys_knee_ligament_minor_p4', 'sys_knee_tendon_p1', 'sys_knee_tendon_p2', 'sys_knee_tendon_p3', 'sys_knee_tendon_p4', 'sys_knee_tendon_p5', 'sys_knee_generic_p1', 'sys_knee_generic_p2', 'sys_knee_generic_p3', 'sys_knee_generic_p4', 'sys_knee_generic_p5', 'sys_ankle_ligament_major_p1', 'sys_ankle_ligament_major_p2', 'sys_ankle_ligament_major_p3', 'sys_ankle_ligament_major_p4', 'sys_ankle_ligament_major_p5', 'sys_ankle_ligament_minor_p1', 'sys_ankle_ligament_minor_p2', 'sys_ankle_ligament_minor_p3', 'sys_ankle_ligament_minor_p4', 'sys_ankle_generic_p1', 'sys_ankle_generic_p2', 'sys_ankle_generic_p3', 'sys_ankle_generic_p4', 'sys_ankle_generic_p5', 'sys_hamstring_muscular_p1', 'sys_hamstring_muscular_p2', 'sys_hamstring_muscular_p3', 'sys_hamstring_muscular_p4', 'sys_hamstring_muscular_p5', 'sys_calf_muscular_p1', 'sys_calf_muscular_p2', 'sys_calf_muscular_p3', 'sys_calf_muscular_p4', 'sys_calf_muscular_p5', 'sys_quadriceps_muscular_p1', 'sys_quadriceps_muscular_p2', 'sys_quadriceps_muscular_p3', 'sys_quadriceps_muscular_p4', 'sys_quadriceps_muscular_p5', 'sys_groin_any_p1', 'sys_groin_any_p2', 'sys_groin_any_p3', 'sys_groin_any_p4', 'sys_groin_any_p5', 'sys_lower_limb_muscular_p1', 'sys_lower_limb_muscular_p2', 'sys_lower_limb_muscular_p3', 'sys_lower_limb_muscular_p4', 'sys_lower_limb_muscular_p5', 'sys_shoulder_instability_p1', 'sys_shoulder_instability_p2', 'sys_shoulder_instability_p3', 'sys_shoulder_instability_p4', 'sys_shoulder_instability_p5', 'sys_shoulder_tendon_p1', 'sys_shoulder_tendon_p2', 'sys_shoulder_tendon_p3', 'sys_shoulder_tendon_p4', 'sys_shoulder_tendon_p5', 'sys_shoulder_generic_p1', 'sys_shoulder_generic_p2', 'sys_shoulder_generic_p3', 'sys_shoulder_generic_p4', 'sys_shoulder_generic_p5', 'sys_upper_limb_bone_p1', 'sys_upper_limb_bone_p2', 'sys_upper_limb_bone_p3', 'sys_upper_limb_bone_p4', 'sys_spine_generic_p1', 'sys_spine_generic_p2', 'sys_spine_generic_p3', 'sys_spine_generic_p4', 'sys_spine_generic_p5', 'sys_bone_generic_p1', 'sys_bone_generic_p2', 'sys_bone_generic_p3', 'sys_bone_generic_p4', 'sys_default_generic_p1', 'sys_default_generic_p2', 'sys_default_generic_p3', 'sys_default_generic_p4', 'sys_default_generic_p5');
DELETE FROM rtp_templates t
  WHERE t."isSystem" AND t.id NOT IN ('sys_knee_ligament_major', 'sys_knee_ligament_minor', 'sys_knee_tendon', 'sys_knee_generic', 'sys_ankle_ligament_major', 'sys_ankle_ligament_minor', 'sys_ankle_generic', 'sys_hamstring_muscular', 'sys_calf_muscular', 'sys_quadriceps_muscular', 'sys_groin_any', 'sys_lower_limb_muscular', 'sys_shoulder_instability', 'sys_shoulder_tendon', 'sys_shoulder_generic', 'sys_upper_limb_bone', 'sys_spine_generic', 'sys_bone_generic', 'sys_default_generic');

-- ─── 7. Protocolli gia' avviati ─────────────────────────
--
-- I protocolli esistenti non hanno fasi proprie: senza queste righe la pagina
-- RTP resterebbe vuota per gli infortuni gia' in corso. Si ricostruiscono le
-- cinque fasi storiche, con i nomi che l'interfaccia mostrava prima.
-- `templateName` resta NULL: quei protocolli non vengono da nessun template
-- ed e' giusto che lo dicano.

INSERT INTO "rtp_protocol_phases" ("id", "rtpProtocolId", "phase", "order", "name")
SELECT p."id" || '_ph' || v.ord, p."id", v.ph::"RTPPhase", v.ord, v.nm
FROM "rtp_protocols" p
CROSS JOIN (VALUES
  ('PHASE_1', 1, 'Controllo dolore'),
  ('PHASE_2', 2, 'Mobilita'' e forza base'),
  ('PHASE_3', 3, 'Sport-specifico'),
  ('PHASE_4', 4, 'Allenamento completo'),
  ('PHASE_5', 5, 'Return to competition')
) AS v(ph, ord, nm)
WHERE NOT EXISTS (
  SELECT 1 FROM "rtp_protocol_phases" x WHERE x."rtpProtocolId" = p."id"
)
ON CONFLICT ("id") DO NOTHING;

-- Ordine dei criteri gia' inseriti: prima erano ordinati per data di
-- creazione, adesso c'e' una colonna. Solo le righe rimaste a 0.
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "rtpProtocolId", "phase" ORDER BY "createdAt", "id"
  ) AS rn
  FROM "clearance_criteria"
)
UPDATE "clearance_criteria" c
SET "order" = o.rn
FROM ordered o
WHERE c."id" = o."id" AND c."order" = 0;

DO $$
DECLARE t INT; ph INT; cr INT; pp INT;
BEGIN
  SELECT count(*) INTO t  FROM rtp_templates WHERE "isSystem";
  SELECT count(*) INTO ph FROM rtp_template_phases;
  SELECT count(*) INTO cr FROM rtp_template_criteria;
  SELECT count(*) INTO pp FROM rtp_protocol_phases;
  RAISE NOTICE 'rtp_templates: % template di sistema, % fasi, % criteri; % fasi su protocolli esistenti.', t, ph, cr, pp;
END $$;
