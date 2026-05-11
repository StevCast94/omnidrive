#!/usr/bin/env bash
# ============================================================
# OmniDrive — Deploy script (Día 7 checklist)
# Ejecutar desde la raíz del monorepo
# ============================================================
set -e

echo "🚗 OmniDrive Deploy Pipeline"
echo "=============================="

# ── 1. Generar claves VAPID si no existen ───────────────────
if [ -z "$VAPID_PUBLIC_KEY" ]; then
  echo "⚠️  Generando claves VAPID..."
  npx web-push generate-vapid-keys
  echo "→ Copia las claves al .env del backend y al .env del web"
fi

# ── 2. Backend: build y migrate ─────────────────────────────
echo ""
echo "📦 Backend: instalando dependencias..."
cd backend
npm ci

echo "🗄️  Prisma: generando cliente y migrando DB..."
npx prisma generate
npx prisma migrate deploy   # usa migrations de producción

echo "🔨 TypeScript: compilando..."
npm run build

echo "✅ Backend listo"
cd ..

# ── 3. Web: build ───────────────────────────────────────────
echo ""
echo "🌐 Web: instalando dependencias..."
cd web
npm ci

echo "🔨 Vite: compilando..."
npm run build

echo "✅ Web lista (dist/)"
cd ..

# ── 4. Health check (opcional si tienes la URL) ─────────────
if [ -n "$RAILWAY_URL" ]; then
  echo ""
  echo "🏥 Health check: $RAILWAY_URL/health"
  curl -sf "$RAILWAY_URL/health" && echo " → OK" || echo " → FALLÓ"
fi

echo ""
echo "🎉 Deploy completo"
echo "   Backend → Railway (push a main branch)"
echo "   Web     → Netlify (push a main branch)"


# ============================================================
# README — Pasos manuales de deploy
# ============================================================
# 
# BACKEND (Railway)
# -----------------
# 1. Crear proyecto en railway.app
# 2. Add service → GitHub repo → carpeta /backend
# 3. Variables de entorno: copiar todo de backend/.env.example
# 4. Add service → PostgreSQL (Railway provee la DB)
#    → Copiar DATABASE_URL al env del servicio backend
# 5. Deploy automático en cada push a main ✓
#
# WEB (Netlify)
# -------------
# 1. Crear site en netlify.com → Import from Git → carpeta /web
# 2. Build command: npm run build
# 3. Publish directory: dist
# 4. Variables de entorno: copiar todo de web/.env.example
# 5. Deploy automático en cada push a main ✓
#
# SUPABASE (Storage)
# ------------------
# 1. Crear proyecto en supabase.com
# 2. Storage → New bucket → "omnidrive" (public)
# 3. Settings → API → copiar URL y service_role key
# 4. SQL Editor → correr: ALTER TABLE ... (ver abajo)
#
# STRIPE
# ------
# 1. dashboard.stripe.com → Developers → API keys
# 2. Copiar pk_ (para web) y sk_ (para backend)
# 3. Webhooks → Add endpoint → https://[railway-url]/api/stripe/webhook
#    → Eventos: payment_intent.succeeded, account.updated
#
# VAPID (Push Notifications)
# --------------------------
# npx web-push generate-vapid-keys
# → Copiar Public a backend .env y web .env
# → Copiar Private SOLO a backend .env
