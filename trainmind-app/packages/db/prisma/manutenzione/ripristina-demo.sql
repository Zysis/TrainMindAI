-- Annulla rinomina-demo.sql, se serve tornare indietro.
--
-- Aggiornato il 21/09/2026: nome e cognome su "user_identities",
-- email su "users" (migration 20260920090000_identity_vault).
-- L'ordine conta: prima si rimette l'email, poi si usa quella
-- nuova email per trovare l'organizzazione.
BEGIN;

UPDATE user_identities
   SET "firstName" = 'Alessandro',
       "lastName"  = 'Vispa'
 WHERE "userId" = (SELECT id FROM users WHERE email = 'coach@example.com');

UPDATE users
   SET email = 'alessandro.vispa@gmail.com'
 WHERE email = 'coach@example.com';

UPDATE organizations
   SET name = 'AV'
 WHERE id = (SELECT "organizationId" FROM users WHERE email = 'alessandro.vispa@gmail.com');

COMMIT;
