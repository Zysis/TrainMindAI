<#
.SYNOPSIS
    Ricognizione in sola lettura del database TrainMind, locale o di produzione.

.DESCRIPTION
    Esegue inventario.sql dentro il container Postgres. Non apre porte e non
    richiede tunnel: in locale usa `docker exec`, sul server passa da `ssh` e
    poi `docker exec`. Nessuna credenziale transita in chiaro sulla rete.

.PARAMETER Ambiente
    'locale' (default) oppure 'server'.

.PARAMETER Vps
    Host o IP del server. Obbligatorio con -Ambiente server.

.EXAMPLE
    .\inventario.ps1
    .\inventario.ps1 -Ambiente server -Vps 123.45.67.89
#>
param(
    [ValidateSet('locale', 'server')]
    [string]$Ambiente = 'locale',

    [string]$Vps
)

$ErrorActionPreference = 'Stop'
$sqlPath = Join-Path $PSScriptRoot 'inventario.sql'

if (-not (Test-Path $sqlPath)) {
    throw "File non trovato: $sqlPath"
}

if ($Ambiente -eq 'server' -and -not $Vps) {
    throw "Con -Ambiente server devi indicare -Vps <host-o-ip>"
}

$sql = Get-Content $sqlPath -Raw

if ($Ambiente -eq 'locale') {
    Write-Host "`n=== DATABASE LOCALE (container trainmind-postgres) ===" -ForegroundColor Cyan
    $sql | docker exec -i trainmind-postgres psql -U trainmind -d trainmind_db
}
else {
    Write-Host "`n=== DATABASE DI PRODUZIONE su $Vps ===" -ForegroundColor Yellow
    Write-Host "Sola lettura: nessuna modifica verra' effettuata.`n" -ForegroundColor Yellow
    # Il comando SQL viaggia sullo stdin di ssh e viene passato a psql dentro
    # il container: non serve copiare file sul server ne' esporre la porta.
    $sql | ssh "root@$Vps" "docker exec -i trainmind-postgres psql -U trainmind -d trainmind_db"
}
