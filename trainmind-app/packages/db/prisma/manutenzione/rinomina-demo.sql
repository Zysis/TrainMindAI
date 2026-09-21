-- ============================================================
-- Sostituisce l'identita' personale nell'organizzazione usata
-- per le guide (PDF e video, tre lingue).
--
-- Perche': nome, cognome ed email personale comparivano in una
-- trentina di figure per lingua — barra in alto, saluto della
-- dashboard, menu profilo, impostazioni — e le guide vanno in
-- mano ai clienti.
--
-- Dopo questo aggiornamento l'accesso a quell'account avviene
-- con coach@example.com, stessa password di prima.
-- example.com e' riservato dallo standard (RFC 2606): non e' di
-- nessuno e non si rischia di scrivere davvero a qualcuno.
--
-- Aggiornato il 21/09/2026: dopo la migration
-- 20260920090000_identity_vault nome e cognome stanno su
-- "user_identities", l'email resta su "users". Servono percio'
-- due UPDATE invece di uno.
-- ============================================================

BEGIN;

-- Prima si guarda cosa si sta per cambiare.
SELECT u.id AS utente, u.email, iu."firstName", iu."lastName", o.name AS organizzazione
  FROM users u
  LEFT JOIN user_identities iu ON iu."userId" = u.id
  JOIN organizations o ON o.id = u."organizationId"
 WHERE u.email = 'alessandro.vispa@gmail.com';

UPDATE organizations
   SET name = 'TrainMind Demo'
 WHERE id = (SELECT "organizationId" FROM users WHERE email = 'alessandro.vispa@gmail.com');

UPDATE user_identities
   SET "firstName" = 'Coach',
       "lastName"  = 'Demo'
 WHERE "userId" = (SELECT id FROM users WHERE email = 'alessandro.vispa@gmail.com');

UPDATE users
   SET email = 'coach@example.com'
 WHERE email = 'alessandro.vispa@gmail.com';

-- E cosa e' diventato.
SELECT u.id AS utente, u.email, iu."firstName", iu."lastName", o.name AS organizzazione
  FROM users u
  LEFT JOIN user_identities iu ON iu."userId" = u.id
  JOIN organizations o ON o.id = u."organizationId"
 WHERE u.email = 'coach@example.com';

COMMIT;
