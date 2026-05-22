const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const supabase = createClient(
  'https://rkwbixidpaqweavghfea.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc2NjE5OCwiZXhwIjoyMDkzMzQyMTk4fQ.YhuyGwW8qia858aqMfu3nhPkmLNoIRgdWpQ6AxSvI9U'
);

async function main() {
  console.log('=== LIMPIANDO TODO ===');

  // 1. Borrar TODOS de Supabase Auth
  console.log('\n1. Borrando usuarios de Supabase Auth...');
  const { data: users } = await supabase.auth.admin.listUsers();
  let count = 0;
  for (const u of users?.users || []) {
    console.log('   Delete:', u.email || u.id);
    await supabase.auth.admin.deleteUser(u.id);
    count++;
  }
  console.log('   OK:', count, 'usuarios borrados');

  // 2. Borrar datos de BD (try/catch por tablas que no existen)
  console.log('\n2. Borrando datos de la BD...');
  const tables = ['Message','Conversation','Notification','Transaction','Payment','Subscription','UserDocument','Tracking','Review','Booking','Vehicle','User'];
  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe('DELETE FROM "' + t + '"');
      console.log('   OK', t);
    } catch {
      console.log('   SKIP', t);
    }
  }
  
  // 3. Crear superadmin en Auth
  console.log('\n3. Creando superadmin en Auth...');
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: 'superadmin@omnidrive.lat',
    password: '089858890@Id',
    email_confirm: true,
  });
  if (authErr) throw new Error('Auth: ' + authErr.message);
  console.log('   Auth ID:', authData.user.id);

  // 4. Perfil superadmin
  console.log('\n4. Perfil superadmin...');
  const sa = await prisma.user.create({
    data: {
      authId: authData.user.id,
      email: 'superadmin@omnidrive.lat',
      phone: '+593999000001',
      name: 'Stevens',
      lastName: 'SuperAdmin',
      username: 'stevens',
      documentType: 'cedula',
      documentId: '1700000000',
      role: 'superadmin',
      identityVerified: true,
      verifiedAt: new Date(),
    },
  });
  console.log('   Profile ID:', sa.id);

  console.log('\n========================================');
  console.log('   LOGIN:    superadmin@omnidrive.lat');
  console.log('   PASSWORD: 089858890@Id');
  console.log('   ROL:      superadmin');
  console.log('   ADMIN:    https://omnidrive.lat/admin');
  console.log('========================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());
