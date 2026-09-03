<#
.SYNOPSIS
  Restores backups\kltn_erp_backup.dump into the running kltn_postgres database.

.DESCRIPTION
  Use this after moving the project to a new machine (docker-compose already
  creates a fresh, empty Postgres volume there) to replace whatever the
  container auto-seeded with the real data captured by backup-db.ps1.

  THIS IS DESTRUCTIVE: it drops and recreates every table in the kltn_erp
  database before loading the backup. Run it BEFORE the backend container has
  a chance to do anything else with the data, ideally like this:

    docker-compose up -d db          # start only Postgres first
    .\restore-db.ps1                 # wait for it healthy, then restore
    docker-compose up -d             # now start backend/worker/frontend

  If you run it after the full stack is already up, it still works (the
  backend/worker just briefly saw the auto-seeded data before it get replaced).

.PARAMETER BackupFile
  Path to the .dump file to restore. Defaults to backups\kltn_erp_backup.dump.

.PARAMETER Force
  Skip the confirmation prompt.

.EXAMPLE
  .\restore-db.ps1

.EXAMPLE
  .\restore-db.ps1 -Force
#>

param(
    [string]$BackupFile = (Join-Path $PSScriptRoot 'backups\kltn_erp_backup.dump'),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$containerName = 'kltn_postgres'
$dbName = 'kltn_erp'
$dbUser = 'postgres'
$containerTmpFile = '/tmp/restore.dump'

if (-not (Test-Path $BackupFile)) {
    Write-Host "Backup file not found: $BackupFile" -ForegroundColor Red
    Write-Host "Run .\backup-db.ps1 on the source machine first, and make sure backups\ was included in the transfer." -ForegroundColor Yellow
    exit 1
}

$running = docker ps --filter "name=^/$containerName$" --format "{{.Names}}"
if (-not $running) {
    Write-Host "Container '$containerName' is not running. Starting it (docker-compose up -d db)..." -ForegroundColor Cyan
    docker-compose up -d db
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start the db service." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Waiting for Postgres to accept connections..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    docker exec $containerName pg_isready -U $dbUser -d $dbName *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    Write-Host "Postgres never became ready after 60s." -ForegroundColor Red
    exit 1
}

if (-not $Force) {
    Write-Host ""
    Write-Host "This will DROP and REPLACE every table currently in the '$dbName' database" -ForegroundColor Yellow
    Write-Host "with the contents of: $BackupFile" -ForegroundColor Yellow
    $answer = Read-Host "Continue? (y/N)"
    if ($answer -notin @('y', 'Y', 'yes', 'Yes')) {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

$fileName = Split-Path $BackupFile -Leaf
docker cp $BackupFile "${containerName}:${containerTmpFile}"

Write-Host "Restoring... this can take a minute for large backups." -ForegroundColor Cyan
docker exec $containerName pg_restore -U $dbUser -d $dbName --clean --if-exists -1 $containerTmpFile
$restoreExit = $LASTEXITCODE

docker exec $containerName rm -f $containerTmpFile

if ($restoreExit -ne 0) {
    Write-Host "pg_restore reported errors (exit code $restoreExit). Check the output above." -ForegroundColor Red
    exit $restoreExit
}

Write-Host "Restore complete." -ForegroundColor Green
Write-Host "If the backend/worker containers were already running, restart them so any in-memory cache picks up the restored data:" -ForegroundColor Yellow
Write-Host "  docker-compose restart backend worker" -ForegroundColor Yellow
