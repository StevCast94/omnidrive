-- Aceptacion de textos legales, con version.
-- Sin version, una aceptacion no dice a que se dijo que si.
CREATE TABLE "LegalAcceptance" (
    "id"        UUID NOT NULL,
    "userId"    UUID NOT NULL,
    "tipo"      TEXT NOT NULL,
    "version"   TEXT NOT NULL,
    "ip"        TEXT,
    "userAgent" TEXT,
    "bookingId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegalAcceptance_userId_tipo_version_key" ON "LegalAcceptance"("userId", "tipo", "version");
CREATE INDEX "LegalAcceptance_userId_idx" ON "LegalAcceptance"("userId");
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
