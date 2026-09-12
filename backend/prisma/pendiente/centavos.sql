-- Dinero a centavos enteros.
-- Las columnas ya son integer (db push las convirtio), pero guardan dolares.
-- Este UPDATE es lo unico que falta, y va junto al refactor del codigo.

UPDATE "Booking" SET
  "baseAmount"   = "baseAmount"   * 100,
  "driverFee"    = "driverFee"    * 100,
  "insuranceFee" = "insuranceFee" * 100,
  "serviceFee"   = "serviceFee"   * 100,
  "totalAmount"  = "totalAmount"  * 100,
  "deposit"      = "deposit"      * 100;

UPDATE "Vehicle" SET
  "pricePerHour" = "pricePerHour" * 100,
  "pricePerDay"  = "pricePerDay"  * 100,
  "pricePerKm"   = "pricePerKm"   * 100,
  "deposit"      = "deposit"      * 100,
  "driverPrice"  = "driverPrice"  * 100;

UPDATE "User"         SET "walletBalance" = "walletBalance" * 100;
UPDATE "Transaction"  SET "amount" = "amount" * 100, "fee" = "fee" * 100;
UPDATE "Subscription" SET "price" = "price" * 100;
