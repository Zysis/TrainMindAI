-- Annulla rinomina-demo.sql, se serve tornare indietro.
BEGIN;

UPDATE users
   SET "firstName" = 'Alessandro',
       "lastName"  = 'Vispa',
       email       = 'alessandro.vispa@gmail.com'
 WHERE email = 'coach@example.com';

UPDATE organizations
   SET name = 'AV'
 WHERE id = (SELECT "organizationId" FROM users WHERE email = 'alessandro.vispa@gmail.com');

COMMIT;
