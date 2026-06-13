# ShieldAudit - one-command start (Windows / PowerShell)
# Prereq: Docker Desktop installed and running.
#
#   .\start.ps1
#
# First build takes a few minutes. App: http://localhost:3000  (Ctrl+C to stop)

$ErrorActionPreference = 'Stop'

# Verify the Docker daemon is reachable before trying to build.
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker daemon not reachable. Start Docker Desktop, then re-run .\start.ps1" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "  ShieldAudit -> http://localhost:3000" -ForegroundColor Cyan
Write-Host "  (first build takes a few minutes; Ctrl+C to stop, 'docker compose down' to remove)" -ForegroundColor DarkGray
Write-Host ""

docker compose up --build
