const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const supabase = createClient(
  'https://rkwbixidpaqweavghfea.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbG…vI9U'
);

async function main() {
  const email = 'stevens@omnidrive.lat';
  const password = 'Admin2026!';

  // 1. Borrar si ya existe
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === email);
  if (found) {
    await supabase.auth.admin.deleteUser(found.id);
    await prisma.user.deleteMany({ where: { email } });
    console.log('Deleted old user');
  }

  // 2. Crear en Supabase Auth
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr) throw new Error('Auth error: ' + authErr.message);
  console.log('Created auth user:', authData.user.id);

  // 3. Crear perfil admin
  const user = await prisma.user.create({
    data: {
      authId: authData.user.id,
      email,
      phone: '+593999000000',
      name: 'Stevens',
      lastName: 'Admin',
      documentType: 'cedula',
      documentId: '1700000001',
      role: 'admin',
      identityVerified: true,
      verifiedAt: new Date(),
    },
  });
  console.log('Created profile:', user.id);
  console.log('Login:', email, '/', password);
}

main().catch(console.error).finally(() => prisma.$disconnect());
