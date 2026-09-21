\echo '=== file diag2, scritto 15/09, aggiornato 21/09 per il vault delle identita ==='
--
-- Dopo la migration 20260920090000_identity_vault, nomi e cognomi non stanno
-- piu' su "athletes" e "users" ma su "athlete_identities" e "user_identities".
-- Ogni query che li vuole deve fare il join.

\echo '=== 1. organizzazioni ==='
SELECT id, name, tier FROM "organizations" ORDER BY name;

\echo '=== 2. squadre, con organizzazione e numero di atleti ==='
SELECT t.id, t.name AS squadra, o.name AS organizzazione,
       (SELECT count(*) FROM "athlete_teams" at WHERE at."teamId" = t.id) AS atleti
FROM "teams" t
JOIN "organizations" o ON o.id = t."organizationId"
ORDER BY o.name, t.name;

\echo '=== 3. ogni Bortolotti: scheda, sua organizzazione, squadre e org delle squadre ==='
SELECT a.id AS atleta_id, ia."firstName", ia."lastName",
       oa.name AS org_atleta,
       t.name  AS squadra,
       ot.name AS org_squadra
FROM "athletes" a
JOIN "athlete_identities" ia ON ia."athleteId" = a.id
LEFT JOIN "organizations" oa ON oa.id = a."organizationId"
LEFT JOIN "athlete_teams" at ON at."athleteId" = a.id
LEFT JOIN "teams" t  ON t.id = at."teamId"
LEFT JOIN "organizations" ot ON ot.id = t."organizationId"
WHERE ia."lastName" = 'Bortolotti'
ORDER BY a.id;

\echo '=== 4. account con ruolo ATHLETE ==='
SELECT u.id, u.email, iu."firstName", iu."lastName",
       o.name AS organizzazione,
       ia."firstName" || ' ' || ia."lastName" AS scheda_collegata,
       a."organizationId" = u."organizationId" AS stessa_org
FROM "users" u
JOIN "organizations" o ON o.id = u."organizationId"
LEFT JOIN "user_identities" iu ON iu."userId" = u.id
LEFT JOIN "athletes" a ON a.id = u."athleteId"
LEFT JOIN "athlete_identities" ia ON ia."athleteId" = a.id
WHERE u.role = 'ATHLETE';

\echo '=== 5. righe athlete_teams che attraversano due organizzazioni ==='
SELECT at.id, ia."firstName" || ' ' || ia."lastName" AS atleta,
       oa.name AS org_atleta, t.name AS squadra, ot.name AS org_squadra
FROM "athlete_teams" at
JOIN "athletes" a ON a.id = at."athleteId"
JOIN "athlete_identities" ia ON ia."athleteId" = a.id
JOIN "teams" t    ON t.id = at."teamId"
JOIN "organizations" oa ON oa.id = a."organizationId"
JOIN "organizations" ot ON ot.id = t."organizationId"
WHERE a."organizationId" <> t."organizationId";
