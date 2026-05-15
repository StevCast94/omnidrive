#!/bin/sh
# ===== entry.sh - Para Railway =====
# Railway no ejecuta build en producción, solo npm start
# Este script corre antes de arrancar para preparar Prisma

echo "[Entry] Running prisma generate..."
npx prisma generate 2>&1

echo "[Entry] Syncing database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "[Entry] Schema sync skipped (non-fatal)"

echo "[Entry] Starting OmniDrive API..."
exec npx tsx src/index.ts
