#!/bin/sh
# ===== entry.sh — Para Railway =====

echo "[Entry] Running prisma generate..."
npx prisma generate 2>&1

echo "[Entry] Running migrations..."
npx tsx scripts/migrate-rating.ts 2>&1 || echo "[Entry] Migration skipped (non-fatal)"

echo "[Entry] Syncing database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "[Entry] Schema sync skipped (non-fatal)"

echo "[Entry] Starting OmniDrive API..."
exec npx tsx src/index.ts
