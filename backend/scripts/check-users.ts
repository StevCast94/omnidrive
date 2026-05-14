import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({ select: { email: true, phone: true, documentId: true } });
  console.log(JSON.stringify(users, null, 2));
  await p.$disconnect();
}
main();
