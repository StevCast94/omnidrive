-- Migration: índices de rendimiento para tablas calientes (2026-06-03)
-- Ejecutado por entry.sh de forma idempotente (IF NOT EXISTS en PostgreSQL)

-- Booking: búsquedas por vehículo + estado (conflictos de fechas, búsqueda)
CREATE INDEX IF NOT EXISTS "idx_booking_vehicle_status" ON "Booking"("vehicleId", "status");
CREATE INDEX IF NOT EXISTS "idx_booking_tenant" ON "Booking"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_booking_renter" ON "Booking"("renterId");
CREATE INDEX IF NOT EXISTS "idx_booking_status_start" ON "Booking"("status", "startAt");

-- Vehicle: listings por dueño, categoría, disponibilidad
CREATE INDEX IF NOT EXISTS "idx_vehicle_owner" ON "Vehicle"("ownerId");
CREATE INDEX IF NOT EXISTS "idx_vehicle_category" ON "Vehicle"("category");
CREATE INDEX IF NOT EXISTS "idx_vehicle_available" ON "Vehicle"("available");

-- Review: ratings por usuario y por vehículo
CREATE INDEX IF NOT EXISTS "idx_review_target" ON "Review"("targetId");
CREATE INDEX IF NOT EXISTS "idx_review_vehicle" ON "Review"("vehicleId");

-- Notification: bandeja por usuario + no leídas
CREATE INDEX IF NOT EXISTS "idx_notif_user_read" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "idx_notif_created" ON "Notification"("createdAt");

-- Message: historial por conversación
CREATE INDEX IF NOT EXISTS "idx_message_conv" ON "Message"("conversationId", "createdAt");

-- Conversation: búsqueda por participantes
CREATE INDEX IF NOT EXISTS "idx_conversation_users" ON "Conversation" USING GIN ("userIds");
