# Voce narrante dei video — istruzioni

Questa cartella genera l'audio dei tre video della guida. Gira **sul tuo PC**:
la chiave OpenAI non esce da qui e non viene scritta da nessuna parte.

## Cosa c'è

| file | cosa fa |
|---|---|
| `genera-voce.mjs` | chiama la TTS di OpenAI e salva un mp3 per scena |
| `narration-it.json`, `-en`, `-es` | il copione: 38 scene per lingua, ~10,5 minuti |
| `audio/<lingua>/` | dove finiscono gli mp3 (la crea lo script) |

## Come si lancia

PowerShell, dentro questa cartella:

```powershell
$env:OPENAI_API_KEY = "sk-..."
node genera-voce.mjs it en es
```

Serve Node 18 o superiore (usa `fetch` nativo). Verifica con `node -v`.

Ci vogliono circa quattro minuti per lingua. Lo script stampa una riga per
scena e va avanti anche se una fallisce.

## Se qualcosa va storto

- **È ripartibile.** Rilancia lo stesso comando: salta le scene già fatte e
  rifà solo quelle mancanti. Nessun costo doppio.
- **Una scena suona male?** Cancella il suo `.mp3` e rilancia: rigenera solo
  quella.
- **Errori 429.** Sono limiti di frequenza. Lo script riprova da solo fino a
  quattro volte con attese crescenti; se insiste, aspetta un minuto e
  rilancia.

## Costo indicativo

Circa 9.000 caratteri per lingua, 27.000 in totale. Con `gpt-4o-mini-tts` sono
pochi centesimi complessivi — ma controlla la tariffa aggiornata sul tuo
account, non fidarti di questo numero.

## Poi

Quando le tre cartelle `audio/it`, `audio/en`, `audio/es` sono piene, dimmelo:
prendo io gli mp3 e monto i video. Il montaggio (schermate, zoom lento,
sottotitoli bruciati, concatenazione) avviene nel mio ambiente, non serve
altro da parte tua.

## Una nota sulla voce

Il copione chiede una lettura calma, da collega che spiega, non da spot. Se
preferisci un'altra voce, cambia `"voice"` in cima ai tre file `narration-*.json`:
`onyx` (quella attuale, maschile e piena), `alloy`, `echo`, `fable`, `nova`,
`shimmer`. Cancella la cartella `audio/` e rilancia per sentirne un'altra.
