-- ============================================================
-- Utente Postgres per la console di amministrazione
-- ============================================================
--
-- La console non scrive nulla. Le si da' un utente che NON PUO' scrivere:
-- cosi' un bug nelle query, o una console compromessa, non possono toccare i
-- dati dei clienti. E' la stessa idea del "least privilege" applicata al
-- database invece che al codice.
--
-- Da lanciare UNA VOLTA, come utente proprietario del database:
--
--   dc exec postgres psql -U trainmind -d trainmind_db -f /tmp/reporting-role.sql
--
-- ATTENZIONE al nome del database: qui sotto e' scritto `trainmind_db`, che e'
-- il valore di POSTGRES_DB in .env.deploy.example. Se sul tuo server e'
-- diverso, cambialo in tutte e tre le righe (GRANT CONNECT, il comando qui
-- sopra e la stringa DATABASE_URL_READONLY).
--
-- (prima copiare il file dentro il container:
--   docker cp infra/sql/reporting-role.sql trainmind-postgres:/tmp/ )
--
-- Sostituire la password prima di eseguire, e riportare la stessa in
-- DATABASE_URL_READONLY dentro .env.deploy.

CREATE ROLE trainmind_reporting LOGIN PASSWORD 'CAMBIAMI';

GRANT CONNECT ON DATABASE trainmind_db TO trainmind_reporting;
GRANT USAGE   ON SCHEMA public      TO trainmind_reporting;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO trainmind_reporting;

-- Le tabelle create in futuro (nuove migrazioni) sarebbero altrimenti
-- invisibili alla console finche' qualcuno non rilancia la GRANT a mano.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO trainmind_reporting;

-- Cintura di sicurezza: anche se un domani qualcuno assegnasse per sbaglio
-- privilegi di scrittura, questa impostazione rende la sessione in sola
-- lettura per default.
ALTER ROLE trainmind_reporting SET default_transaction_read_only = on;

-- Verifica: deve rispondere 'off' per il proprietario e 'on' per il reporting.
--   SELECT rolname, rolconfig FROM pg_roles WHERE rolname = 'trainmind_reporting';
