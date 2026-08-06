@echo off
REM Aggiorna tutto e apre la dashboard interattiva nel browser,
REM con il bottone "Aggiorna ora" funzionante.
REM Lascia questa finestra aperta: e' lei che serve la pagina.

cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo Python non trovato nel PATH.
  pause
  exit /b 1
)

python _sistema\importa.py --dashboard %*
