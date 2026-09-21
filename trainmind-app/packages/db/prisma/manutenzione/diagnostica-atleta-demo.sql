-- Diagnostica per la figura B26-01 della guida (scheda profilo nell'app atleta).
--
-- Due cose non tornano in quella schermata:
--   1. l'email dell'atleta demo Nicola Bortolotti e' l'indirizzo personale
--      di chi ha costruito il prodotto, e finirebbe nelle guide dei clienti;
--   2. la riga "Squadre" dice "Primer Equipo" mentre l'app del preparatore,
--      sugli stessi dati, dice "First Team".
--
-- Questo file non modifica niente: guarda e basta.
--
-- Aggiornato il 21/09/2026. Due correzioni:
--   - nomi ed email degli atleti stanno su "athlete_identities" dopo la
--     migration 20260920090000_identity_vault;
--   - la versione precedente usava anche "athletes"."teamId" e
--     "athletes"."userId", colonne che non esistono piu' da prima del vault:
--     il legame con la squadra passa da "athlete_teams", quello con
--     l'account da "users"."athleteId".

\echo '--- squadre presenti nell organizzazione demo ---'
SELECT t.id, t.name, o.name AS organizzazione,
       (SELECT count(*) FROM "athlete_teams" at WHERE at."teamId" = t.id) AS atleti
FROM "teams" t
JOIN "organizations" o ON o.id = t."organizationId"
ORDER BY o.name, t.name;

\echo '--- atleta Nicola Bortolotti: email, squadre, utente collegato ---'
SELECT a.id, ia."firstName", ia."lastName", ia.email AS email_atleta,
       string_agg(t.name, ', ' ORDER BY t.name) AS squadre,
       u.email AS email_utente_app
FROM "athletes" a
JOIN "athlete_identities" ia ON ia."athleteId" = a.id
LEFT JOIN "athlete_teams" at ON at."athleteId" = a.id
LEFT JOIN "teams" t ON t.id = at."teamId"
LEFT JOIN "users" u ON u."athleteId" = a.id
WHERE ia."lastName" = 'Bortolotti'
GROUP BY a.id, ia."firstName", ia."lastName", ia.email, u.email;

\echo '--- tutti gli indirizzi non-example.com nella demo ---'
SELECT 'athlete' AS tipo, ia.email FROM "athlete_identities" ia
  WHERE ia.email IS NOT NULL AND ia.email NOT LIKE '%@example.com'
UNION ALL
SELECT 'user', u.email FROM "users" u
  JOIN "organizations" o ON o.id = u."organizationId"
  WHERE o.name = 'TrainMind Demo' AND u.email NOT LIKE '%@example.com';
