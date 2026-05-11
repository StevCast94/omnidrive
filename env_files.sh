# ============================================================
# backend/.env.example — Railway environment variables
# ============================================================

# PostgreSQL (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres

# Auth
JWT_SECRET=min-32-chars-random-secret-here

# Supabase Storage
SUPABASE_URL=https://[REF].supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_BUCKET=omnidrive

# Stripe
STRIPE_SECRET_KEY=sk_live_...          # or sk_test_... for dev
STRIPE_WEBHOOK_SECRET=whsec_...

# Web Push (VAPID)
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa40HI8YlOU...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=admin@omnidrive.ec

# App
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://omnidrive.netlify.app


# ============================================================
# web/.env.example — Netlify environment variables
# ============================================================

VITE_API_URL=https://omnidrive-api.railway.app/api
VITE_VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa40HI8YlOU...
VITE_MAPBOX_TOKEN=pk.eyJ1IjoiLi4uIn0...
VITE_STRIPE_PK=pk_live_...             # or pk_test_... for dev


# ============================================================
# Generar claves VAPID (ejecutar UNA vez en local)
# ============================================================
# npx web-push generate-vapid-keys
#
# Output:
# Public Key:  BEl62iUYgUivxIkv69y...
# Private Key: GaYaRiIwL3TnTB1RkSr...
#
# Copiar ambas claves a backend/.env y VITE_VAPID_PUBLIC_KEY al web/.env
