-- Rimozione delle organizzazioni demo — 3 settembre 2026
--
-- Bersagli (decisi guardando i dati di produzione, non i nomi):
--   * basket-demo   "ASD Basket Demo" — i tre account del seed
--                   (trainer@ / medico@ / viewer@trainmind.demo), 10 atleti,
--                   nessuna squadra, nessuna sessione
--   * az-mrm2nsfs   "az" — aa_zz@demo.it, completamente vuota
--
-- NON toccate, anche se hanno il dominio @demo.com: AG (Giottoli, 569
-- sessioni), MM (Minieri, 101), RP (Parretta, 246), VDB (Del Bianco, 265).
-- Sono tester veri: il dominio dell'email non dice niente su cosa c'e' dentro.
--
-- Tutto dentro una transazione: se una riga fallisce non resta un'org a meta'.
-- Da provare PRIMA su una copia (prova_prod) e solo dopo in produzione, con un
-- backup fresco.

BEGIN;

CREATE TEMP TABLE da_eliminare AS
  SELECT id FROM organizations WHERE slug IN ('basket-demo', 'az-mrm2nsfs');

-- Se i due slug non combaciano, meglio fermarsi che cancellare a caso.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM da_eliminare;
  IF n <> 2 THEN
    RAISE EXCEPTION 'Attese 2 organizzazioni, trovate %. Controlla gli slug prima di procedere.', n;
  END IF;
END $$;

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

-- Cosa resta: devono essere quattro organizzazioni, AG MM RP VDB.
SELECT o.name AS societa_rimaste,
       (SELECT count(*) FROM users u WHERE u."organizationId" = o.id) AS utenti,
       (SELECT count(*) FROM athletes a WHERE a."organizationId" = o.id) AS atleti
FROM organizations o ORDER BY 1;

COMMIT;
