-- Auth propio + base limpia.
--
-- Todos los usuarios y vehiculos existentes eran de prueba, y el proyecto
-- Supabase que guardaba las identidades ya no existe: los authId apuntaban a
-- un sistema de auth inexistente. Se vacia y se empieza limpio, que de paso
-- elimina los 6 vehiculos ficticios que publicaban reputacion inventada.
--
-- Hay backup verificado del 12-sep-2026 (restore comprobado en CI).

TRUNCATE TABLE
  "TrackingPoint", "AuditLog", "Review", "Message", "Conversation",
  "Notification", "Transaction", "Subscription", "UserDocument",
  "BannedIdentity", "Booking", "Vehicle", "User"
RESTART IDENTITY CASCADE;

-- Con las tablas vacias, las columnas de dinero (ya integer) no necesitan
-- ninguna conversion: no hay importes que multiplicar por 100.

-- ── User: de Supabase Auth a auth propio ─────────────────────────────
ALTER TABLE "User" DROP COLUMN "authId";
ALTER TABLE "User" ADD COLUMN "passwordHash"    TEXT;
ALTER TABLE "User" ADD COLUMN "googleId"        TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "tokenVersion"    INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- ── Sesiones ─────────────────────────────────────────────────────────
CREATE TABLE "RefreshToken" (
    "id"        UUID NOT NULL,
    "userId"    UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ip"        TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx"    ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PasswordResetToken" (
    "id"        UUID NOT NULL,
    "userId"    UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
