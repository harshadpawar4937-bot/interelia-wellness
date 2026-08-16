#!/bin/sh
set -e

PORT="${PORT:-8000}"

echo "→ Running migrations…"
alembic upgrade head

if [ "${AUTO_SEED_ON_EMPTY:-false}" = "true" ] || [ "${AUTO_SEED_ON_EMPTY:-0}" = "1" ]; then
  echo "→ Seeding catalog if empty…"
  PYTHONPATH=/app python scripts/seed_interelia.py || echo "Seed skipped / already populated"
fi

echo "→ Starting API on 0.0.0.0:${PORT}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
