-- Metriche TrainMind per il calcolo costo-per-utente e break-even.
-- Restituisce una singola riga JSON, pronta da salvare in Fatture/dati/metriche.json
--
-- Uso sul VPS:
--   docker compose exec -T db psql -U <utente> -d <database> -At -f metriche.sql
--
-- Le tabelle usate sono quelle mappate da Prisma:
--   organizations, users, athletes, ai_usage_logs

WITH
mese AS (
  SELECT date_trunc('month', now()) AS inizio
),
org AS (
  SELECT
    count(*)                                                              AS totali,
    count(*) FILTER (WHERE "subscriptionStatus" = 'active')               AS paganti,
    count(*) FILTER (WHERE "subscriptionTier" = 'starter')                AS tier_starter,
    count(*) FILTER (WHERE "subscriptionTier" = 'pro')                    AS tier_pro,
    count(*) FILTER (WHERE "subscriptionTier" = 'ultra')                  AS tier_ultra
  FROM organizations
),
ut AS (
  SELECT
    count(*)                                                              AS totali,
    count(*) FILTER (WHERE "isActive")                                    AS attivi,
    count(*) FILTER (WHERE "lastLoginAt" > now() - interval '30 days')    AS attivi_30gg,
    count(*) FILTER (WHERE "createdAt" >= (SELECT inizio FROM mese))       AS nuovi_mese
  FROM users
),
atl AS (
  SELECT
    count(*)                          AS totali,
    count(*) FILTER (WHERE "isActive") AS attivi
  FROM athletes
),
ai AS (
  SELECT
    coalesce(sum("costUsd") FILTER (WHERE "createdAt" >= (SELECT inizio FROM mese)), 0) AS usd_mese,
    coalesce(sum("costUsd"), 0)                                                          AS usd_totale,
    coalesce(sum("totalTokens") FILTER (WHERE "createdAt" >= (SELECT inizio FROM mese)), 0) AS token_mese,
    count(*) FILTER (WHERE "createdAt" >= (SELECT inizio FROM mese))                      AS chiamate_mese,
    count(*) FILTER (WHERE NOT success AND "createdAt" >= (SELECT inizio FROM mese))      AS errori_mese
  FROM ai_usage_logs
)
SELECT json_build_object(
  'generato_il',                    to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS'),
  'mese_riferimento',               to_char(now(), 'YYYY-MM'),
  'organizzazioni_totali',          org.totali,
  'organizzazioni_paganti',         org.paganti,
  'organizzazioni_per_tier',        json_build_object(
                                      'starter', org.tier_starter,
                                      'pro',     org.tier_pro,
                                      'ultra',   org.tier_ultra),
  'utenti_totali',                  ut.totali,
  'utenti_attivi',                  ut.attivi,
  'utenti_attivi_30gg',             ut.attivi_30gg,
  'utenti_nuovi_mese',              ut.nuovi_mese,
  'atleti_totali',                  atl.totali,
  'atleti_attivi',                  atl.attivi,
  'costo_ai_usd_mese_corrente',     round(ai.usd_mese, 4),
  'costo_ai_usd_totale',            round(ai.usd_totale, 4),
  'token_ai_mese',                  ai.token_mese,
  'chiamate_ai_mese',               ai.chiamate_mese,
  'errori_ai_mese',                 ai.errori_mese,
  'ricavo_mensile_eur',             null
)
FROM org, ut, atl, ai;

-- NOTA su 'ricavo_mensile_eur':
-- resta null finche' non ci sono abbonamenti reali. Quando li avrai, sostituisci
-- il null con il calcolo sui prezzi di listino, per esempio:
--   (org.tier_starter * 0 + org.tier_pro * 29 + org.tier_ultra * 79)
-- contando solo le organizzazioni con subscriptionStatus = 'active'.
