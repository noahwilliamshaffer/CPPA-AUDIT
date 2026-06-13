#!/usr/bin/env bash
# ShieldAudit - one-command start (macOS / Linux)
# Prereq: Docker installed and running.
#
#   ./start.sh
#
# First build takes a few minutes. App: http://localhost:3000  (Ctrl+C to stop)
set -e

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon not reachable. Start Docker, then re-run ./start.sh"
  exit 1
fi

echo ""
echo "  ShieldAudit -> http://localhost:3000"
echo "  (first build takes a few minutes; Ctrl+C to stop, 'docker compose down' to remove)"
echo ""

docker compose up --build
