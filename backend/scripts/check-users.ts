import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const users = await p.user.findMany({ take: 10, select: { email: true, role: true } });
console.log(JSON.stringify(users, null, 2));
await p.$disconnect();
