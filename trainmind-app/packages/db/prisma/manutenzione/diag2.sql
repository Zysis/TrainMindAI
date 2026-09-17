\echo '=== file diag2, scritto 15/09 ==='

\echo '=== 1. organizzazioni ==='
SELECT id, name, tier FROM "organizations" ORDER BY name;

\echo '=== 2. squadre, con organizzazione e numero di atleti ==='
SELECT t.id, t.name AS squadra, o.name AS organizzazione,
       (SELECT count(*) FROM "athlete_teams" at WHERE at."teamId" = t.id) AS atleti
FROM "teams" t
JOIN "organizations" o ON o.id = t."organizationId"
ORDER BY o.name, t.name;

\echo '=== 3. ogni Bortolotti: scheda, sua organizzazione, squadre e org delle squadre ==='
SELECT a.id AS atleta_id, a."firstName", a."lastName",
       oa.name AS org_atleta,
       t.name  AS squadra,
       ot.name AS org_squadra
FROM "athletes" a
LEFT JOIN "organizations" oa ON oa.id = a."organizationId"
LEFT JOIN "athlete_teams" at ON at."athleteId" = a.id
LEFT JOIN "teams" t  ON t.id = at."teamId"
LEFT JOIN "organizations" ot ON ot.id = t."organizationId"
WHERE a."lastName" = 'Bortolotti'
ORDER BY a.id;

\echo '=== 4. account con ruolo ATHLETE ==='
SELECT u.id, u.email, u."firstName", u."lastName",
       o.name AS organizzazione,
       a."firstName" || ' ' || a."lastName" AS scheda_collegata,
       a."organizationId" = u."organizationId" AS stessa_org
FROM "users" u
JOIN "organizations" o ON o.id = u."organizationId"
LEFT JOIN "athletes" a ON a.id = u."athleteId"
WHERE u.role = 'ATHLETE';

\echo '=== 5. righe athlete_teams che attraversano due organizzazioni ==='
SELECT at.id, a."firstName" || ' ' || a."lastName" AS atleta,
       oa.name AS org_atleta, t.name AS squadra, ot.name AS org_squadra
FROM "athlete_teams" at
JOIN "athletes" a ON a.id = at."athleteId"
JOIN "teams" t    ON t.id = at."teamId"
JOIN "organizations" oa ON oa.id = a."organizationId"
JOIN "organizations" ot ON ot.id = t."organizationId"
WHERE a."organizationId" <> t."organizationId";
