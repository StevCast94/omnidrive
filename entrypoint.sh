#!/bin/bash
set -e

echo "=== OmniDrive Entrypoint ==="
cd backend

echo "→ Install dependencies..."
npm install --omit=dev 2>/dev/null || npm install

echo "→ Compile TypeScript..."
npx tsc --noEmitOnError false 2>&1 || echo "(tsc completed with warnings)"

echo "→ Apply DB schema..."
npx prisma db push --skip-generate

echo "→ Create admin if missing..."
node dist/scripts/create-admin.js 2>/dev/null || echo "(admin already exists or script not found)"

echo "→ Prisma seed..."
npx tsx prisma/seed.ts 2>/dev/null || echo "(seed skipped — may already have data)"

echo "→ Starting server on port ${PORT:-3000}..."
exec node dist/index.js
