import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function cleanupUser(email: string) {
  // Buscar usuario en DB
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    console.log('Eliminando perfil de DB:', user.email);
    await prisma.user.delete({ where: { id: user.id } });
  } else {
    console.log('No se encontró perfil en DB para:', email);
  }

  // Buscar en Auth
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listando usuarios Auth:', error.message);
    return;
  }

  const authUser = users.users.find(u => u.email === email);
  if (authUser) {
    console.log('Eliminando usuario de Auth:', authUser.email);
    const { error: delErr } = await supabase.auth.admin.deleteUser(authUser.id);
    if (delErr) {
      console.error('Error eliminando de Auth:', delErr.message);
    } else {
      console.log('Usuario eliminado de Auth correctamente');
    }
  } else {
    console.log('No se encontró en Auth para:', email);
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Uso: node cleanup.js <email>');
  process.exit(1);
}

cleanupUser(email).finally(() => prisma.$disconnect());
