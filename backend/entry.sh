#!/bin/sh
# ===== entry.sh — Para Railway =====

echo "[Entry] Running prisma generate..."
npx prisma generate 2>&1

echo "[Entry] Syncing database schema..."
npx prisma db push --skip-generate 2>&1
echo "[Entry] Applying performance indexes..."
npx prisma db execute --file prisma/migrations/add_indexes.sql 2>&1 || echo "[Entry] Indexes already exist (non-fatal)"

echo "[Entry] Starting OmniDrive API..."
exec npx tsx src/index.ts
