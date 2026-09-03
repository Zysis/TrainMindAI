-- ============================================================
-- TrainMind — Account e dati di prova per le verifiche di deploy
-- ============================================================
--
-- Crea una societa' a se' stante, "Test Deploy", che non tocca nessuno dei
-- dati veri: AG, MM, RP e VDB restano come sono. Serve per le prove che
-- richiedono due utenti nella stessa societa' (il calendario condiviso) e per
-- quelle che richiedono una squadra e degli atleti.
--
-- Cinque account, tutti con password  Admin123!
--
--   admin.test@trainmind.demo         ADMIN
--   preparatore1.test@trainmind.demo  TRAINER
--   preparatore2.test@trainmind.demo  TRAINER
--   medico.test@trainmind.demo        MEDICAL
--   viewer.test@trainmind.demo        VIEWER
--
-- Idempotente: gli id sono fissi (`test_...`) e ogni riga e' un upsert.
-- Rilanciarlo rimette la password a Admin123! e non duplica niente.
--
-- Le hash bcrypt sono a costo 12, le stesse che scrive l'API, e sono state
-- verificate con la stessa libreria che usa il login.
-- `updatedAt` e' scritto a mano ovunque: e' `@updatedAt` di Prisma, quindi in
-- database e' NOT NULL *senza* default, e un INSERT che lo omette fallisce.
-- E' lo stesso inciampo che il 3/9/2026 ha bloccato il seed dei protocolli RTP.
--
-- Per cancellare tutto quando le prove sono finite: in fondo al file.

BEGIN;

-- ─── Societa' ───────────────────────────────────────────
INSERT INTO organizations (id, name, slug, sport, tier, "createdAt", "updatedAt",
                           "subscriptionTier", "subscriptionStatus")
VALUES ('test_org_deploy', 'Test Deploy', 'test-deploy', 'basketball', 'ULTRA',
        NOW(), NOW(), 'ultra', 'active')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, tier = EXCLUDED.tier,
                               "updatedAt" = NOW();

-- ─── Squadre ────────────────────────────────────────────
-- Due, cosi' il selettore della finestra evento ha davvero una scelta da fare.
INSERT INTO teams (id, name, description, color, "organizationId", "createdAt", "updatedAt")
VALUES
  ('test_team_u16', 'Under 16 Test', 'Squadra di prova per le verifiche di deploy', '#14b8a6', 'test_org_deploy', NOW(), NOW()),
  ('test_team_u18', 'Under 18 Test', 'Seconda squadra, serve a controllare il selettore', '#f59e0b', 'test_org_deploy', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, "updatedAt" = NOW();

-- ─── Atleti ─────────────────────────────────────────────
-- Tre bastano: uno serve per l'infortunio all'avambraccio, gli altri due
-- perche' una rosa di uno solo non fa vedere niente nel foglio presenze.
INSERT INTO athletes (id, "firstName", "lastName", "dateOfBirth", "position",
                      "jerseyNumber", height, weight, "isActive",
                      "organizationId", "createdAt", "updatedAt")
VALUES
  ('test_ath_1', 'Luca',   'Prova',    '2009-04-12', 'PG', 4,  178, 70, TRUE, 'test_org_deploy', NOW(), NOW()),
  ('test_ath_2', 'Marco',  'Collaudo', '2009-09-30', 'SG', 7,  186, 78, TRUE, 'test_org_deploy', NOW(), NOW()),
  ('test_ath_3', 'Davide', 'Verifica', '2008-01-23', 'C',  11, 201, 95, TRUE, 'test_org_deploy', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET "firstName" = EXCLUDED."firstName",
                               "lastName"  = EXCLUDED."lastName",
                               "updatedAt" = NOW();

INSERT INTO athlete_teams (id, "athleteId", "teamId", "createdAt")
VALUES
  ('test_at_1', 'test_ath_1', 'test_team_u16', NOW()),
  ('test_at_2', 'test_ath_2', 'test_team_u16', NOW()),
  ('test_at_3', 'test_ath_3', 'test_team_u18', NOW())
ON CONFLICT (id) DO NOTHING;

-- ─── Utenti ─────────────────────────────────────────────
-- Due TRAINER nella stessa societa': sono loro la prova del calendario
-- condiviso. Con un utente solo quella verifica non dimostra niente, perche'
-- i propri eventi si sono sempre visti.
INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role,
                   "isActive", locale, "organizationId", "createdAt", "updatedAt",
                   "consentAnalytics", "consentMarketing", "consentThirdParty",
                   "consentUpdatedAt", "passwordChangedAt")
VALUES
  ('test_u_admin',  'admin.test@trainmind.demo',        '$2b$12$A3vgfGlmhLBLUUZNodrovOBqvghP8qfod20NT/tU8U.AgfVHxHv22', 'Admin',       'Test', 'ADMIN',   TRUE, 'it', 'test_org_deploy', NOW(), NOW(), FALSE, FALSE, FALSE, NOW(), NOW()),
  ('test_u_prep1',  'preparatore1.test@trainmind.demo', '$2b$12$Z6AECSmmdz7N0/n7hsvqhenFjWoiYazKOsItepMDxulsvREQezWEG', 'Preparatore', 'Uno',  'TRAINER', TRUE, 'it', 'test_org_deploy', NOW(), NOW(), FALSE, FALSE, FALSE, NOW(), NOW()),
  ('test_u_prep2',  'preparatore2.test@trainmind.demo', '$2b$12$PbkQIFXFtnrhtxnpsk5mq.VDn4Gun879XbLIf/qBF80Xhz7MNOKGK', 'Preparatore', 'Due',  'TRAINER', TRUE, 'it', 'test_org_deploy', NOW(), NOW(), FALSE, FALSE, FALSE, NOW(), NOW()),
  ('test_u_medico', 'medico.test@trainmind.demo',       '$2b$12$.QskLxcc3jY4aUWc0t1Tzur7qXNBEEAdfjjHRLOGQhNJB5cKIDU92', 'Medico',      'Test', 'MEDICAL', TRUE, 'it', 'test_org_deploy', NOW(), NOW(), FALSE, FALSE, FALSE, NOW(), NOW()),
  ('test_u_viewer', 'viewer.test@trainmind.demo',       '$2b$12$ElK4EwhhJ7E4HjtY67z1ievi6MrxcFoQ3J236e5y88Ak.T2an733K', 'Viewer',      'Test', 'VIEWER',  TRUE, 'it', 'test_org_deploy', NOW(), NOW(), FALSE, FALSE, FALSE, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  email            = EXCLUDED.email,
  "passwordHash"   = EXCLUDED."passwordHash",
  role             = EXCLUDED.role,
  "isActive"       = TRUE,
  "deletedAt"      = NULL,
  "organizationId" = EXCLUDED."organizationId",
  "updatedAt"      = NOW(),
  "passwordChangedAt" = NOW();

COMMIT;

-- ─── Riepilogo ──────────────────────────────────────────
SELECT u.email, u.role, o.name AS societa
FROM users u JOIN organizations o ON o.id = u."organizationId"
WHERE o.id = 'test_org_deploy'
ORDER BY u.role, u.email;

SELECT t.name AS squadra, count(at."athleteId") AS atleti
FROM teams t LEFT JOIN athlete_teams at ON at."teamId" = t.id
WHERE t."organizationId" = 'test_org_deploy'
GROUP BY t.name ORDER BY t.name;

-- ============================================================
-- Per cancellare tutto quando le prove sono finite:
--
--   BEGIN;
--   DELETE FROM calendar_events WHERE "organizationId" = 'test_org_deploy';
--   DELETE FROM injuries       WHERE "athleteId" IN (SELECT id FROM athletes WHERE "organizationId" = 'test_org_deploy');
--   DELETE FROM athlete_teams  WHERE "teamId" IN (SELECT id FROM teams WHERE "organizationId" = 'test_org_deploy');
--   DELETE FROM athletes       WHERE "organizationId" = 'test_org_deploy';
--   DELETE FROM teams          WHERE "organizationId" = 'test_org_deploy';
--   DELETE FROM users          WHERE "organizationId" = 'test_org_deploy';
--   DELETE FROM organizations  WHERE id = 'test_org_deploy';
--   COMMIT;
--
-- Se nel frattempo hai creato allenamenti, partite o report su questa societa'
-- vanno tolti prima loro: le regole di cancellazione non sono a cascata, ed e'
-- voluto. L'errore che esce dice quale tabella sta trattenendo la riga.
-- ============================================================
