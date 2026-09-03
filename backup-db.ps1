<#
.SYNOPSIS
  Dumps the running kltn_postgres database to backups\kltn_erp_backup.dump.

.DESCRIPTION
  Run this before zipping the project to move it to another machine (or just
  periodically) so backups\kltn_erp_backup.dump always reflects the current
  data. Pair with restore-db.ps1 on the destination machine.

.EXAMPLE
  .\backup-db.ps1
#>

$ErrorActionPreference = 'Stop'

$containerName = 'kltn_postgres'
$dbName = 'postgres'
$dbUser = 'postgres'
$backupDir = Join-Path $PSScriptRoot 'backups'
$backupFile = Join-Path $backupDir 'kltn_erp_backup.dump'
$containerTmpFile = '/tmp/kltn_erp_backup.dump'

$running = docker ps --filter "name=^/$containerName$" --format "{{.Names}}"
if (-not $running) {
    Write-Host "Container '$containerName' is not running. Start the stack first (docker-compose up -d db)." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

Write-Host "Dumping database 'kltn_erp' from container '$containerName'..." -ForegroundColor Cyan
docker exec $containerName pg_dump -U $dbUser -d kltn_erp -F c -f $containerTmpFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "pg_dump failed." -ForegroundColor Red
    exit 1
}

docker cp "${containerName}:${containerTmpFile}" $backupFile
docker exec $containerName rm -f $containerTmpFile

$sizeMB = [math]::Round((Get-Item $backupFile).Length / 1MB, 2)
Write-Host "Backup saved: $backupFile ($sizeMB MB)" -ForegroundColor Green
Write-Host "This file travels with the project folder - zip it along with everything else." -ForegroundColor Yellow
