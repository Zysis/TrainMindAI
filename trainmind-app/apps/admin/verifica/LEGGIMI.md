# Controlli sulle query della console

Le pagine della console sono sottili: quasi tutta la sostanza sta nelle query
SQL in `src/lib/queries/`. Questi controlli le fanno girare su un Postgres
vuoto, popolato con quattro società costruite apposta, e verificano che i
numeri che escono siano quelli attesi.

Servono soprattutto a due cose:

1. **Accorgersi quando lo schema cambia.** Le query usano SQL grezzo, quindi
   una colonna rinominata da una migrazione non dà nessun errore di
   compilazione: si scoprirebbe in produzione, con una pagina rotta. Qui si
   scopre subito.
2. **Verificare che il filtro degli account di prova funzioni davvero.** È
   l'unica cosa che separa le statistiche vere dal rumore delle demo.

## Come lanciarli

Serve un Postgres qualsiasi, su un database **vuoto e dedicato**: i dati di
prova non vanno mischiati con nient'altro.

```bash
cd apps/admin/verifica

# 1. genera lo schema minimo dalle definizioni Prisma
cp ../../../packages/db/prisma/schema.prisma .
python3 schema-minimo.py                      # scrive ddl.sql

# 2. prepara il database e popolalo
createdb console_test
psql -d console_test -f ddl.sql
psql -d console_test -f dati-di-prova.sql

# 3. lancia i controlli
cd ..
npx esbuild verifica/controlli.mts --bundle --platform=node --format=esm \
  --outfile=verifica/controlli.mjs --external:pg --alias:@=./src
DATABASE_URL_READONLY="postgresql://localhost/console_test" \
  node verifica/controlli.mjs
```

Atteso: `TUTTI I CONTROLLI PASSANO` (24 controlli).

`ddl.sql`, `controlli.mjs` e `schema.prisma` sono file di appoggio generati:
non vanno versionati.

## Se un controllo fallisce

Prima di cambiare il numero atteso, chiedersi se non sia la query ad avere
ragione. Due volte su tre, scrivendo questi controlli, aveva ragione la query:
per esempio "società che hanno creato una squadra entro sette giorni" vale 2 e
non 1, perché anche la società B una squadra l'aveva creata — semplicemente non
ci ha mai messo dentro nessuno.

## Cosa NON coprono

Il rendering delle pagine; i permessi del ruolo `trainmind_reporting`, che si
verificano sul server (vedi `documentation/GUIDA_CONSOLE_ADMIN.md`); il
comportamento con volumi di dati grandi.
