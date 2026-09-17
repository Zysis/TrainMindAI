-- Rimozione di cinque account di prova dalla PRODUZIONE — 17 settembre 2026
--
--   admin.test@trainmind.demo    ADMIN    Test Deploy
--   medico.test@trainmind.demo   MEDICAL  Test Deploy
--   viewer.test@trainmind.demo   VIEWER   Test Deploy
--   pispi29+vdb@hotmail.it       ATHLETE  VDB   (tester vero: la societa' resta)
--   test@trainmind.demo          ADMIN    test
--
-- Due casi, decisi dai dati e non dai nomi:
--   A) l'account e' l'ULTIMO utente della sua societa' -> se ne va la societa'
--      intera (stesso corpo di rimuovi-org-demo.sql, provato il 3/9).
--   B) nella societa' restano altri utenti -> si cancella solo l'account.
--      Le sue cose personali (chat, notifiche, report, consensi) spariscono;
--      quello che appartiene alla societa' (piani, eventi, inviti, regole di
--      allerta...) passa a un altro utente della stessa societa' (prima un
--      ADMIN, poi un TRAINER). L'anagrafica atleta in VDB NON si tocca.
--
-- PROVA A SECCO PER DEFAULT: senza  -v applica=1  finisce con ROLLBACK e non
-- cambia niente. Guardare i NOTICE, poi rilanciare con  -v applica=1 .
-- Si ferma se uno dei cinque indirizzi non esiste.

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE bersagli (email text PRIMARY KEY);
INSERT INTO bersagli VALUES
  ('admin.test@trainmind.demo'), ('medico.test@trainmind.demo'),
  ('viewer.test@trainmind.demo'), ('pispi29+vdb@hotmail.it'),
  ('test@trainmind.demo');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM users WHERE email IN (SELECT email FROM bersagli);
  IF n <> 5 THEN
    RAISE EXCEPTION 'Attesi 5 account, trovati %. Mi fermo.', n;
  END IF;
END $$;

-- Societa' che restano senza nessun utente -> caso A.
CREATE TEMP TABLE da_eliminare AS
  SELECT DISTINCT u."organizationId" AS id FROM users u
  WHERE u.email IN (SELECT email FROM bersagli)
    AND NOT EXISTS (SELECT 1 FROM users x
                    WHERE x."organizationId" = u."organizationId"
                      AND x.email NOT IN (SELECT email FROM bersagli));

SELECT u.email, o.name AS societa,
       CASE WHEN o.id IN (SELECT id FROM da_eliminare)
            THEN 'A: cancella anche la societa'
            ELSE 'B: cancella solo l''account' END AS piano
FROM users u JOIN organizations o ON o.id = u."organizationId"
WHERE u.email IN (SELECT email FROM bersagli) ORDER BY 3, 2, 1;

-- ── Caso B ──────────────────────────────────────────────────────────
DO $$
DECLARE r record; fk record; erede text; erede_mail text; n int;
BEGIN
  FOR r IN SELECT id, email, "organizationId" AS org FROM users
           WHERE email IN (SELECT email FROM bersagli)
             AND "organizationId" NOT IN (SELECT id FROM da_eliminare)
  LOOP
    SELECT id, email INTO erede, erede_mail FROM users
     WHERE "organizationId" = r.org AND email NOT IN (SELECT email FROM bersagli)
     ORDER BY (role = 'ADMIN') DESC, (role = 'TRAINER') DESC, "createdAt"
     LIMIT 1;
    RAISE NOTICE '% -> quello della societa'' passa a %', r.email, erede_mail;

    -- personali
    IF to_regclass('public.chat_messages') IS NOT NULL THEN
      DELETE FROM chat_messages WHERE "conversationId" IN
        (SELECT id FROM chat_conversations WHERE "userId" = r.id);
    END IF;
    IF to_regclass('public.chat_conversations') IS NOT NULL THEN
      DELETE FROM chat_conversations WHERE "userId" = r.id; END IF;
    IF to_regclass('public.notifications') IS NOT NULL THEN
      DELETE FROM notifications WHERE "userId" = r.id; END IF;
    IF to_regclass('public.reports') IS NOT NULL THEN
      DELETE FROM reports WHERE "userId" = r.id; END IF;
    IF to_regclass('public.consent_records') IS NOT NULL THEN
      DELETE FROM consent_records WHERE "userId" = r.id; END IF;

    -- tutto il resto che punta all'utente senza CASCADE / SET NULL:
    -- letto dal catalogo, cosi' vale anche se la produzione e' indietro
    -- (o avanti) di qualche migration.
    FOR fk IN
      SELECT cl.relname AS tab, a.attname AS col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f'
        AND c.confrelid = 'public.users'::regclass
        AND c.confdeltype NOT IN ('c', 'n')
    LOOP
      IF erede IS NULL THEN
        RAISE EXCEPTION 'Nessun erede per % (tabella %)', r.email, fk.tab;
      END IF;
      EXECUTE format('UPDATE %I SET %I = $1 WHERE %I = $2', fk.tab, fk.col, fk.col)
        USING erede, r.id;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN
        RAISE NOTICE '  %.% -> % righe riassegnate', fk.tab, fk.col, n;
      END IF;
    END LOOP;

    DELETE FROM users WHERE id = r.id;
    RAISE NOTICE '  utente % cancellato', r.email;
  END LOOP;
END $$;

-- ── Caso A ──────────────────────────────────────────────────────────
-- La produzione puo' essere indietro di qualche migration rispetto al locale:
-- alcune tabelle (rtp_templates, ai_usage_logs, ...) potrebbero non esistere
-- ancora. Invece di far fallire tutto, si salta quello che non c'e' e lo si
-- dice. Cosi' lo script gira uguale prima e dopo il deploy delle migration.
CREATE OR REPLACE FUNCTION pg_temp.del_se_esiste(tabella text, condizione text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE quante int;
BEGIN
  IF to_regclass('public.' || tabella) IS NULL THEN
    RAISE NOTICE '  (salto %: tabella non presente in questo database)', tabella;
    RETURN;
  END IF;
  EXECUTE format('DELETE FROM %I WHERE %s', tabella, condizione);
  GET DIAGNOSTICS quante = ROW_COUNT;
  RAISE NOTICE '  % -> % righe', tabella, quante;
END $fn$;

-- ── 1. Quello che pende dagli utenti ────────────────────────────────
SELECT pg_temp.del_se_esiste('chat_messages', '"conversationId" IN (
  SELECT id FROM chat_conversations WHERE "userId" IN (
    SELECT id FROM users WHERE "organizationId" IN (SELECT id FROM da_eliminare)))');
SELECT pg_temp.del_se_esiste('chat_conversations', '"userId" IN (
  SELECT id FROM users WHERE "organizationId" IN (SELECT id FROM da_eliminare))');
SELECT pg_temp.del_se_esiste('notifications', '"userId" IN (
  SELECT id FROM users WHERE "organizationId" IN (SELECT id FROM da_eliminare))');
SELECT pg_temp.del_se_esiste('reports', '"userId" IN (
  SELECT id FROM users WHERE "organizationId" IN (SELECT id FROM da_eliminare))');
SELECT pg_temp.del_se_esiste('consent_records', '"userId" IN (
  SELECT id FROM users WHERE "organizationId" IN (SELECT id FROM da_eliminare))');
SELECT pg_temp.del_se_esiste('audit_logs', '"organizationId" IN (SELECT id FROM da_eliminare)');
SELECT pg_temp.del_se_esiste('ai_usage_logs', '"organizationId" IN (SELECT id FROM da_eliminare)');

-- ── 2. Calendario e sessioni di campo/partita ───────────────────────
-- game_sessions e field_training_sessions hanno anche un proprio
-- organizationId e possono esistere senza evento: si cancellano a parte.
SELECT pg_temp.del_se_esiste('game_sessions', '"organizationId" IN (SELECT id FROM da_eliminare)');
SELECT pg_temp.del_se_esiste('field_training_sessions', '"organizationId" IN (SELECT id FROM da_eliminare)');
-- Gli eventi si prendono passando dall'utente che li ha creati, non da
-- `calendar_events."organizationId"`: quella colonna la aggiunge la migration
-- 20260902170000 e in produzione non c'e' ancora. Cosi' lo script funziona sia
-- prima sia dopo, e non dipende dall'ordine in cui si fanno le due cose.
-- Il risultato e' lo stesso: la migration popola organizationId proprio
-- dall'organizzazione del creatore.
SELECT pg_temp.del_se_esiste('calendar_events', '"userId" IN (
  SELECT id FROM users WHERE "organizationId" IN (SELECT id FROM da_eliminare))');

-- ── 3. Report giornalieri e programmati ─────────────────────────────
SELECT pg_temp.del_se_esiste('daily_reports', '"organizationId" IN (SELECT id FROM da_eliminare)');
SELECT pg_temp.del_se_esiste('report_schedules', '"organizationId" IN (SELECT id FROM da_eliminare)');

-- ── 4. Adattamenti AI ───────────────────────────────────────────────
SELECT pg_temp.del_se_esiste('plan_adaptations', '"organizationId" IN (SELECT id FROM da_eliminare)');

-- ── 5. Clinica (i figli dei protocolli vanno via in cascata) ────────
SELECT pg_temp.del_se_esiste('rtp_protocols', '"athleteId" IN (
  SELECT id FROM athletes WHERE "organizationId" IN (SELECT id FROM da_eliminare))');
SELECT pg_temp.del_se_esiste('injuries', '"athleteId" IN (
  SELECT id FROM athletes WHERE "organizationId" IN (SELECT id FROM da_eliminare))');
SELECT pg_temp.del_se_esiste('rtp_templates', '"organizationId" IN (SELECT id FROM da_eliminare)');

-- ── 6. Dati per atleta ──────────────────────────────────────────────
SELECT pg_temp.del_se_esiste('session_logs', '"athleteId" IN (
  SELECT id FROM athletes WHERE "organizationId" IN (SELECT id FROM da_eliminare))');
SELECT pg_temp.del_se_esiste('wellness_logs', '"athleteId" IN (
  SELECT id FROM athletes WHERE "organizationId" IN (SELECT id FROM da_eliminare))');
SELECT pg_temp.del_se_esiste('metrics', '"athleteId" IN (
  SELECT id FROM athletes WHERE "organizationId" IN (SELECT id FROM da_eliminare))');
SELECT pg_temp.del_se_esiste('alert_rules', '"organizationId" IN (SELECT id FROM da_eliminare)');
SELECT pg_temp.del_se_esiste('staff_invites', '"organizationId" IN (SELECT id FROM da_eliminare)');
SELECT pg_temp.del_se_esiste('athlete_invites', '"organizationId" IN (SELECT id FROM da_eliminare)');

-- ── 7. Sessioni e piani (weeks e session_exercises in cascata) ──────
SELECT pg_temp.del_se_esiste('training_sessions', '"organizationId" IN (SELECT id FROM da_eliminare)');
SELECT pg_temp.del_se_esiste('training_plans', '"organizationId" IN (SELECT id FROM da_eliminare)');
SELECT pg_temp.del_se_esiste('periodization_plans', '"organizationId" IN (SELECT id FROM da_eliminare)');

-- ── 8. Utenti PRIMA degli atleti ────────────────────────────────────
-- `users.athleteId` punta all'atleta per gli account di tipo ATHLETE:
-- cancellare prima l'atleta violerebbe quella foreign key.
SELECT pg_temp.del_se_esiste('users', '"organizationId" IN (SELECT id FROM da_eliminare)');

-- ── 9. Anagrafiche e organizzazione ─────────────────────────────────
SELECT pg_temp.del_se_esiste('athlete_teams', '"athleteId" IN (
  SELECT id FROM athletes WHERE "organizationId" IN (SELECT id FROM da_eliminare))');
SELECT pg_temp.del_se_esiste('athletes', '"organizationId" IN (SELECT id FROM da_eliminare)');
SELECT pg_temp.del_se_esiste('teams', '"organizationId" IN (SELECT id FROM da_eliminare)');
SELECT pg_temp.del_se_esiste('exercises', '"organizationId" IN (SELECT id FROM da_eliminare)');
SELECT pg_temp.del_se_esiste('organizations', 'id IN (SELECT id FROM da_eliminare)');

-- Verifica: la prima query non deve restituire righe.
SELECT email AS ancora_presenti FROM users WHERE email IN (SELECT email FROM bersagli);
SELECT o.name AS societa,
       (SELECT count(*) FROM users u WHERE u."organizationId" = o.id) AS utenti,
       (SELECT count(*) FROM athletes a WHERE a."organizationId" = o.id) AS atleti
FROM organizations o ORDER BY 1;

\if :{?applica}
  COMMIT;
  \echo '>>> APPLICATO.'
\else
  ROLLBACK;
  \echo '>>> PROVA A SECCO: nessuna modifica. Rilancia con -v applica=1 per applicare.'
\endif
