@echo off
REM Aggiorna tutto il sistema spese TrainMind: metriche VPS, fatture PDF, Excel, dashboard.
REM Si puo' lanciare con un doppio clic oppure da PowerShell: .\aggiorna.bat

cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo Python non trovato nel PATH.
  pause
  exit /b 1
)

python _sistema\importa.py %*
set CODICE=%errorlevel%

echo.
if "%CODICE%"=="0" (
  echo Fatto. Apri Dashboard-Spese.html o Registro-Spese.xlsx.
) else (
  echo Si e' verificato un errore ^(codice %CODICE%^).
)

REM la pausa serve solo se lanciato con doppio clic, non da terminale
echo %cmdcmdline% | find /i "%~0" >nul
if not errorlevel 1 pause
exit /b %CODICE%
