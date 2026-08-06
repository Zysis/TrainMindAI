#!/usr/bin/env bash
# Aggiorna tutto il sistema spese TrainMind con un comando solo:
#   metriche dal VPS  ->  lettura fatture PDF  ->  Excel + dashboard
#
#   bash aggiorna.sh                  tutto
#   bash aggiorna.sh --senza-metriche  salta il collegamento al VPS
#   bash aggiorna.sh --reimporta       rilegge tutti i PDF da zero
#
# Le impostazioni del VPS stanno in _sistema/config.json e si possono
# sovrascrivere al volo:  VPS_HOST=root@1.2.3.4 bash aggiorna.sh

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# usa python3 se c'e', altrimenti python (tipico su Windows)
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python non trovato nel PATH." >&2
  exit 1
fi

"$PY" _sistema/importa.py "$@"
