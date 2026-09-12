-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "trackingConsentAt" TIMESTAMP(3),
ALTER COLUMN "baseAmount" SET DATA TYPE INTEGER USING (ROUND("baseAmount" * 100))::integer,
ALTER COLUMN "driverFee" SET DEFAULT 0,
ALTER COLUMN "driverFee" SET DATA TYPE INTEGER USING (ROUND("driverFee" * 100))::integer,
ALTER COLUMN "serviceFee" SET DATA TYPE INTEGER USING (ROUND("serviceFee" * 100))::integer,
ALTER COLUMN "totalAmount" SET DATA TYPE INTEGER USING (ROUND("totalAmount" * 100))::integer,
ALTER COLUMN "deposit" SET DATA TYPE INTEGER USING (ROUND("deposit" * 100))::integer,
ALTER COLUMN "insuranceFee" SET DEFAULT 0,
ALTER COLUMN "insuranceFee" SET DATA TYPE INTEGER USING (ROUND("insuranceFee" * 100))::integer;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ALTER COLUMN "price" SET DATA TYPE INTEGER USING (ROUND("price" * 100))::integer;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ALTER COLUMN "amount" SET DATA TYPE INTEGER USING (ROUND("amount" * 100))::integer,
ALTER COLUMN "fee" SET DEFAULT 0,
ALTER COLUMN "fee" SET DATA TYPE INTEGER USING (ROUND("fee" * 100))::integer;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT 'EC',
ADD COLUMN     "documentCountry" TEXT NOT NULL DEFAULT 'EC',
ADD COLUMN     "walletCurrency" TEXT NOT NULL DEFAULT 'USD',
ALTER COLUMN "walletBalance" SET DEFAULT 0,
ALTER COLUMN "walletBalance" SET DATA TYPE INTEGER USING (ROUND("walletBalance" * 100))::integer;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT 'EC',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ALTER COLUMN "pricePerHour" SET DATA TYPE INTEGER USING (ROUND("pricePerHour" * 100))::integer,
ALTER COLUMN "pricePerDay" SET DATA TYPE INTEGER USING (ROUND("pricePerDay" * 100))::integer,
ALTER COLUMN "deposit" SET DEFAULT 0,
ALTER COLUMN "deposit" SET DATA TYPE INTEGER USING (ROUND("deposit" * 100))::integer,
ALTER COLUMN "driverPrice" SET DATA TYPE INTEGER USING (ROUND("driverPrice" * 100))::integer,
ALTER COLUMN "pricePerKm" SET DATA TYPE INTEGER USING (ROUND("pricePerKm" * 100))::integer;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingPoint" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "TrackingPoint_bookingId_recordedAt_idx" ON "TrackingPoint"("bookingId", "recordedAt");

-- CreateIndex
CREATE INDEX "Booking_vehicleId_status_idx" ON "Booking"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "Booking_tenantId_idx" ON "Booking"("tenantId");

-- CreateIndex
CREATE INDEX "Booking_renterId_idx" ON "Booking"("renterId");

-- CreateIndex
CREATE INDEX "Booking_status_startAt_idx" ON "Booking"("status", "startAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Review_targetId_idx" ON "Review"("targetId");

-- CreateIndex
CREATE INDEX "Review_vehicleId_idx" ON "Review"("vehicleId");

-- CreateIndex
CREATE INDEX "Transaction_toUserId_idx" ON "Transaction"("toUserId");

-- CreateIndex
CREATE INDEX "Transaction_bookingId_idx" ON "Transaction"("bookingId");

-- CreateIndex
CREATE INDEX "Vehicle_ownerId_idx" ON "Vehicle"("ownerId");

-- CreateIndex
CREATE INDEX "Vehicle_category_idx" ON "Vehicle"("category");

-- CreateIndex
CREATE INDEX "Vehicle_available_idx" ON "Vehicle"("available");

-- CreateIndex
CREATE INDEX "Vehicle_countryCode_idx" ON "Vehicle"("countryCode");

-- AddForeignKey
ALTER TABLE "TrackingPoint" ADD CONSTRAINT "TrackingPoint_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

