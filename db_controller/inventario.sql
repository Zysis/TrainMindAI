-- ============================================================
-- Ricognizione del contenuto del database
-- ------------------------------------------------------------
-- Sola lettura: non modifica nulla.
--
-- Usa pg_stat_user_tables, che riporta un conteggio STIMATO delle righe
-- mantenuto da PostgreSQL. E' immediato anche su tabelle grandi, mentre un
-- COUNT(*) su 37 tabelle richiederebbe una scansione completa di ciascuna.
-- La stima puo' discostarsi leggermente dal valore reale dopo molte
-- scritture; per un conteggio esatto su una singola tabella:
--     SELECT COUNT(*) FROM "nome_tabella";
-- ============================================================

\echo ''
\echo '=== RIGHE PER TABELLA (stima) ==='
SELECT
    relname                AS tabella,
    n_live_tup             AS righe,
    pg_size_pretty(pg_total_relation_size(relid)) AS spazio
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_live_tup DESC;

\echo ''
\echo '=== TABELLE VUOTE ==='
SELECT string_agg(relname, ', ' ORDER BY relname) AS vuote
FROM pg_stat_user_tables
WHERE n_live_tup = 0;

\echo ''
\echo '=== UTENTI ==='
SELECT email, role, "isActive", "deletedAt" IS NOT NULL AS cancellato
FROM users
ORDER BY role, email;

\echo ''
\echo '=== ORGANIZZAZIONI E CONSISTENZA ==='
SELECT
    o.name                                    AS organizzazione,
    o.tier                                    AS piano,
    (SELECT COUNT(*) FROM users u     WHERE u."organizationId" = o.id) AS utenti,
    (SELECT COUNT(*) FROM athletes a  WHERE a."organizationId" = o.id) AS atleti,
    (SELECT COUNT(*) FROM teams t     WHERE t."organizationId" = o.id) AS squadre
FROM organizations o
ORDER BY o.name;

\echo ''
\echo '=== ATLETI: quanti dati collegati ha ciascuno ==='
\echo '(utile per capire cosa verrebbe travolto da una cancellazione)'
SELECT
    a."firstName" || ' ' || a."lastName"      AS atleta,
    a."isActive"                              AS attivo,
    (SELECT COUNT(*) FROM wellness_logs w WHERE w."athleteId" = a.id) AS wellness,
    (SELECT COUNT(*) FROM injuries i      WHERE i."athleteId" = a.id) AS infortuni
FROM athletes a
ORDER BY a."lastName", a."firstName";
