import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  await p.$executeRawUnsafe(`ALTER TABLE "User" RENAME COLUMN "driverScore" TO "rating"`).catch(() => {});
  await p.$executeRawUnsafe(`ALTER TABLE "User" DROP COLUMN IF EXISTS "totalKm"`).catch(() => {});
  console.log('[Migration] Rename driverScore -> rating OK');
}

main()
  .catch(() => {})
  .finally(() => p.$disconnect().then(() => process.exit(0)));
