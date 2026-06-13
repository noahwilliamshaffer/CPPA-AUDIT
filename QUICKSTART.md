# ShieldAudit — Quick Start (Docker)

Run the entire app — web UI, SQLite database, schema, and the §7123(c) question
bank — in one container. No external database, no cloud accounts required.

## Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and **running**.

## Run it

**Windows (PowerShell):**
```powershell
.\start.ps1
```

**macOS / Linux:**
```bash
./start.sh
```

Or directly with Compose (any OS):
```bash
docker compose up --build
```

Then open **http://localhost:3000**. The first build takes a few minutes; later
starts are fast. On boot the container creates the database schema and seeds the
48-question bank automatically.

## Optional: enable real AI autofill
Without a key the app runs in **mock mode** (the document-upload → autofill flow
works, but answers are flagged for manual review — no AI calls). To enable real
analysis, create a `.env` file next to `docker-compose.yml`:

```
ANTHROPIC_API_KEY=sk-ant-...
# optional: override the model (defaults to claude-sonnet-4-5)
# ANTHROPIC_MODEL=claude-sonnet-4-5
```

…then `docker compose up --build` again.

## Data, backup, reset
All audit data lives in the `shieldaudit_data` Docker volume on your machine — it
never leaves it.

```bash
# stop (keeps data)
docker compose down

# back up the database volume
docker run --rm -v shieldaudit_data:/data -v "${PWD}:/out" alpine \
  tar czf /out/shieldaudit-backup.tar.gz -C /data .

# wipe ALL data and start fresh
docker compose down -v
```

## Local development (without Docker)
```bash
npm install
npm run setup     # creates the SQLite DB + seeds the question bank
npm run dev       # http://localhost:3000
```
