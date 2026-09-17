-- Diagnostica per la figura B26-01 della guida (scheda profilo nell'app atleta).
--
-- Due cose non tornano in quella schermata:
--   1. l'email dell'atleta demo Nicola Bortolotti e' l'indirizzo personale
--      di chi ha costruito il prodotto, e finirebbe nelle guide dei clienti;
--   2. la riga "Squadre" dice "Primer Equipo" mentre l'app del preparatore,
--      sugli stessi dati, dice "First Team".
--
-- Questo file non modifica niente: guarda e basta.

\echo '--- squadre presenti nell organizzazione demo ---'
SELECT t.id, t.name, o.name AS organizzazione,
       (SELECT count(*) FROM "athletes" a WHERE a."teamId" = t.id) AS atleti
FROM "teams" t
JOIN "organizations" o ON o.id = t."organizationId"
ORDER BY o.name, t.name;

\echo '--- atleta Nicola Bortolotti: email, squadra, utente collegato ---'
SELECT a.id, a."firstName", a."lastName", a.email AS email_atleta,
       t.name AS squadra, u.email AS email_utente_app
FROM "athletes" a
LEFT JOIN "teams" t ON t.id = a."teamId"
LEFT JOIN "users" u ON u.id = a."userId"
WHERE a."lastName" = 'Bortolotti';

\echo '--- tutti gli indirizzi non-example.com nella demo ---'
SELECT 'athlete' AS tipo, a.email FROM "athletes" a
  WHERE a.email IS NOT NULL AND a.email NOT LIKE '%@example.com'
UNION ALL
SELECT 'user', u.email FROM "users" u
  JOIN "organizations" o ON o.id = u."organizationId"
  WHERE o.name = 'TrainMind Demo' AND u.email NOT LIKE '%@example.com';
