-- Il calendario diventa della societa', non della persona.
--
-- Prima `calendar_events` era filtrato per `userId`: due preparatori della
-- stessa societa' non vedevano gli eventi l'uno dell'altro, e aprire il foglio
-- di campo o i minuti partita su un evento creato da un collega rispondeva
-- "evento non trovato". `userId` resta, ma come "chi l'ha creato".

-- 1. La colonna nasce annullabile, altrimenti non si puo' popolare.
ALTER TABLE "calendar_events" ADD COLUMN "organizationId" TEXT;

-- 2. Ogni evento eredita l'organizzazione di chi l'ha creato.
UPDATE "calendar_events" ce
SET "organizationId" = u."organizationId"
FROM "users" u
WHERE ce."userId" = u.id;

-- 3. Gli eventi senza squadra vanno all'Under 14 della LORO organizzazione
--    (decisione dell'utente, 2/9/2026). Dove quella squadra non esiste
--    l'evento resta senza: il vincolo di squadra obbligatoria vale solo sui
--    tipi collettivi e solo da qui in avanti, quindi lo storico non si rompe.
UPDATE "calendar_events" ce
SET "teamId" = t.id
FROM "teams" t
WHERE ce."teamId" IS NULL
  AND ce."organizationId" IS NOT NULL
  AND t."organizationId" = ce."organizationId"
  AND lower(t.name) = 'under 14';

-- 4. Adesso la colonna puo' diventare obbligatoria.
ALTER TABLE "calendar_events" ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX "calendar_events_organizationId_idx" ON "calendar_events"("organizationId");

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
