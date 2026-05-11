#!/bin/bash
# OmniDrive entrypoint
set -e

echo "=== OmniDrive Start ==="

# Run migrations (non-fatal)
echo "Running prisma db push..."
npx prisma db push --accept-data-loss 2>&1 || echo "Migration note: $?"
echo "Done."

# Start server
echo "Starting server on port ${PORT:-3000}..."
exec node dist/index.js
