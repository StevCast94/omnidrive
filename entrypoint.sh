#!/bin/bash
set -e

echo "=== OmniDrive Entrypoint ==="
cd backend

echo "→ Apply DB schema..."
npx prisma db push --skip-generate

echo "→ Create admin if missing..."
node dist/scripts/create-admin.js 2>/dev/null || echo "(admin already exists or script not found)"

echo "→ Starting server on port ${PORT:-3000}..."
exec node dist/index.js
