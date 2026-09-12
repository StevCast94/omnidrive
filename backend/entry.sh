#!/bin/sh
# ===== entry.sh — Railway =====
set -e

echo "[Entry] prisma generate..."
npx prisma generate

# Migraciones versionadas. Antes esto era `prisma db push --accept-data-loss`,
# que sincroniza el esquema sin historial y puede borrar columnas sin avisar.
# El 12-sep-2026 convirtio el dinero a integer sin el x100 que la migracion
# escrita a mano si hacia: por eso ya no se usa.
echo "[Entry] prisma migrate deploy..."
npx prisma migrate deploy

echo "[Entry] Arrancando OmniDrive API..."
exec npx tsx src/index.ts
