-- ============================================================
-- ROLLBACK del caveau delle identita' (20260920090000_identity_vault)
-- ============================================================
--
-- Riporta nome, cognome, data di nascita, email e foto dentro `athletes` e
-- `users`, ricopiandoli dal caveau. Le tabelle caveau NON vengono cancellate:
-- si eliminano a mano, dopo aver verificato che l'applicazione vecchia gira.
--
--   docker cp packages\db\prisma\manutenzione\rollback-identity-vault.sql trainmind-postgres:/tmp/rb.sql
--   docker exec trainmind-postgres psql -U trainmind -d trainmind_db -v ON_ERROR_STOP=1 -f /tmp/rb.sql
--
-- Serve anche il rollback del CODICE (immagine api/web precedente): uno schema
-- vecchio con codice nuovo non parte.

BEGIN;

ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "firstName"   TEXT;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "lastName"    TEXT;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "email"       TEXT;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "photoUrl"    TEXT;

UPDATE "athletes" a
   SET "firstName"   = i."firstName",
       "lastName"    = i."lastName",
       "dateOfBirth" = i."dateOfBirth",
       "email"       = i."email",
       "photoUrl"    = i."photoUrl"
  FROM "athlete_identities" i
 WHERE i."athleteId" = a."id";

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastName"  TEXT;

UPDATE "users" u
   SET "firstName" = i."firstName",
       "lastName"  = i."lastName"
  FROM "user_identities" i
 WHERE i."userId" = u."id";

DO $$
DECLARE buchi INT;
BEGIN
    SELECT count(*) INTO buchi FROM "athletes"
     WHERE "firstName" IS NULL OR "lastName" IS NULL OR "dateOfBirth" IS NULL;
    IF buchi > 0 THEN
        RAISE EXCEPTION 'STOP: % atleti senza anagrafica ripristinata.', buchi;
    END IF;

    SELECT count(*) INTO buchi FROM "users"
     WHERE "firstName" IS NULL OR "lastName" IS NULL;
    IF buchi > 0 THEN
        RAISE EXCEPTION 'STOP: % utenti senza anagrafica ripristinata.', buchi;
    END IF;
END $$;

ALTER TABLE "athletes" ALTER COLUMN "firstName"   SET NOT NULL;
ALTER TABLE "athletes" ALTER COLUMN "lastName"    SET NOT NULL;
ALTER TABLE "athletes" ALTER COLUMN "dateOfBirth" SET NOT NULL;
ALTER TABLE "users"    ALTER COLUMN "firstName"   SET NOT NULL;
ALTER TABLE "users"    ALTER COLUMN "lastName"    SET NOT NULL;

ALTER TABLE "athletes" DROP COLUMN IF EXISTS "birthYear";

DELETE FROM "_trainmind_data_migrations" WHERE "name" = '20260920090000_identity_vault';

COMMIT;

-- Solo dopo aver verificato che tutto gira:
--   DROP TABLE "athlete_identities";
--   DROP TABLE "user_identities";
