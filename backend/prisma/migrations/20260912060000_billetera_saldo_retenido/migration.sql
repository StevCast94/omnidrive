-- Saldo retenido: lo que ya no puede gastar el inquilino porque hay una
-- reserva confirmada, pero que todavia no es de nadie mas.
--
-- La invariante es: walletBalance (disponible) + heldBalance (retenido) es
-- todo el dinero de esa persona en la plataforma.
ALTER TABLE "User" ADD COLUMN "heldBalance" INTEGER NOT NULL DEFAULT 0;

-- El libro mayor se consulta por persona y por reserva.
CREATE INDEX IF NOT EXISTS "Transaction_fromUserId_idx" ON "Transaction"("fromUserId");
CREATE INDEX IF NOT EXISTS "Transaction_status_type_idx" ON "Transaction"("status", "type");
