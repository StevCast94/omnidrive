// Seed OmniDrive using Supabase REST API (no Prisma needed for remote)
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rkwbixidpaqweavghfea.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc2NjE5OCwiZXhwIjoyMDkzMzQyMTk4fQ.YhuyGwW8qia858aqMfu3nhPkmLNoIRgdWpQ6AxSvI9U';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const headers = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`
};

function restPost(table, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'rkwbixidpaqweavghfea.supabase.co',
      path: `/rest/v1/${table}`,
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)[0]); }
        catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function createAuthUser(email, password, phone) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email, password, phone,
    email_confirm: true,
    phone_confirm: true,
  });
  if (error || !data.user) throw new Error(`Auth creation failed for ${email}: ${error?.message}`);
  return data.user.id;
}

async function main() {
  console.log('🌱 Seeding OmniDrive...\n');

  // ── Create auth users in Supabase first ─────────────────
  const adminAuthId  = await createAuthUser('admin@omnidrive.ec', 'Admin1234!', '+593900000000');
  console.log('  ✓ Auth: admin@omnidrive.ec');
  const ownerAuthId  = await createAuthUser('carlos@demo.ec', 'Owner1234!', '+593991111111');
  console.log('  ✓ Auth: carlos@demo.ec');
  const tenantAuthId = await createAuthUser('sofia@demo.ec', 'Tenant1234!', '+593992222222');
  console.log('  ✓ Auth: sofia@demo.ec');

  const now = new Date().toISOString();

  // ── Admin ──────────────────────────────────────────────
  const admin = await restPost('User', {
    authId: adminAuthId,
    email: 'admin@omnidrive.ec',
    phone: '+593900000000',
    name: 'Admin',
    lastName: 'OmniDrive',
    documentType: 'cedula',
    documentId: '0000000000',
    identityVerified: true,
    verifiedAt: now,
    role: 'admin',
    walletBalance: 0,
    driverScore: 1000,
  });
  console.log('  ✓ Admin:', admin?.id);

  // ── Owner demo ─────────────────────────────────────────
  const owner = await restPost('User', {
    authId: ownerAuthId,
    email: 'carlos@demo.ec',
    phone: '+593991111111',
    name: 'Carlos',
    lastName: 'Mendoza',
    documentType: 'cedula',
    documentId: '1712345678',
    identityVerified: true,
    verifiedAt: now,
    walletBalance: 250.00,
    driverScore: 820,
    totalTrips: 14,
  });
  console.log('  ✓ Owner:', owner?.id);

  // ── Tenant demo ────────────────────────────────────────
  const tenant = await restPost('User', {
    authId: tenantAuthId,
    email: 'sofia@demo.ec',
    phone: '+593992222222',
    name: 'Sofía',
    lastName: 'Paredes',
    documentType: 'cedula',
    documentId: '1798765432',
    identityVerified: true,
    verifiedAt: now,
    walletBalance: 500.00,
    subscriptionTier: 'premium',
    driverScore: 760,
    totalTrips: 6,
  });
  console.log('  ✓ Tenant:', tenant?.id);

  // ── Vehicles ───────────────────────────────────────────
  const vehiclesData = [
    {
      brand: 'Toyota', model: 'Corolla', year: 2023, plate: 'PBG-1234',
      color: 'Blanco perla', vin: 'JTDBU4EE1A9012345',
      category: 'car', seats: 5, transmission: 'automatic', fuelType: 'gasoline',
      pricePerHour: 8.00, pricePerDay: 55.00, deposit: 100.00,
      locationLat: -0.1807, locationLng: -78.4678, locationName: 'La Carolina, Quito Norte',
      insurance: true, features: ['ac','bluetooth','usb','backup_camera'],
      photos: ['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800'],
      ownerId: owner.id,
    },
    {
      brand: 'Chevrolet', model: 'D-MAX', year: 2022, plate: 'PCA-5678',
      color: 'Gris oscuro', vin: 'JACDPA12A7A067890',
      category: 'truck', seats: 5, transmission: 'manual', fuelType: 'diesel',
      pricePerHour: 12.00, pricePerDay: 80.00, deposit: 200.00,
      locationLat: -0.2295, locationLng: -78.5243, locationName: 'Valle de los Chillos',
      insurance: true, features: ['ac','bluetooth'],
      photos: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'],
      ownerId: owner.id,
    },
    {
      brand: 'Yamaha', model: 'MT-07', year: 2023, plate: 'MBG-9012',
      color: 'Negro mate', vin: 'JYARJ18E09A012345',
      category: 'motorcycle', seats: 2, transmission: 'manual', fuelType: 'gasoline',
      pricePerHour: 5.00, pricePerDay: 35.00, deposit: 150.00,
      locationLat: -0.1547, locationLng: -78.4710, locationName: 'Iñaquito, Quito',
      insurance: false, features: ['bluetooth'],
      photos: ['https://images.unsplash.com/photo-1558980394-4c7c9299fe96?w=800'],
      ownerId: owner.id,
    },
    {
      brand: 'BMW', model: 'X5', year: 2022, plate: 'PBH-3456',
      color: 'Negro carbón', vin: '5UXKR0C50JL012345',
      category: 'luxury', seats: 5, transmission: 'automatic', fuelType: 'gasoline',
      pricePerHour: 25.00, pricePerDay: 180.00, deposit: 500.00,
      locationLat: -0.1900, locationLng: -78.4850, locationName: 'González Suárez, Quito',
      insurance: true, features: ['ac','gps','bluetooth','usb','leather','sunroof'],
      photos: ['https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800'],
      ownerId: owner.id,
    },
    {
      brand: 'Kia', model: 'Sportage', year: 2023, plate: 'PCC-7890',
      color: 'Rojo pasión', vin: 'KNDPM3AC8J7012345',
      category: 'suv', seats: 5, transmission: 'automatic', fuelType: 'gasoline',
      pricePerHour: 10.00, pricePerDay: 65.00, deposit: 120.00,
      locationLat: -0.2100, locationLng: -78.5100, locationName: 'Cumbayá, Quito',
      insurance: true, features: ['ac','gps','bluetooth','backup_camera'],
      photos: ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800'],
      ownerId: owner.id,
    },
    {
      brand: 'Hyundai', model: 'H1', year: 2021, plate: 'PBC-2345',
      color: 'Plata', vin: 'KMHWG81JXAU012345',
      category: 'van', seats: 12, transmission: 'automatic', fuelType: 'diesel',
      pricePerHour: 15.00, pricePerDay: 95.00, deposit: 250.00,
      locationLat: -0.2400, locationLng: -78.5200, locationName: 'Sangolquí, Rumiñahui',
      withDriver: true, driverPrice: 35.00,
      insurance: true, features: ['ac','bluetooth','usb'],
      photos: ['https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800'],
      ownerId: owner.id,
    },
  ];

  for (const v of vehiclesData) {
    const veh = await restPost('Vehicle', v);
    console.log(`  ✓ Vehicle: ${v.brand} ${v.model} (${v.plate})`);
  }

  // ── Demo subscription ──────────────────────────────────
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);
  await restPost('Subscription', {
    userId: tenant.id,
    tier: 'premium',
    price: 9.99,
    interval: 'monthly',
    startsAt: now,
    endsAt: endDate.toISOString(),
    status: 'active',
    benefits: ['Pagos P2P con wallet interna', 'Sin comisión en primeras 3 reservas/mes', 'Soporte prioritario', 'Tracking GPS incluido', 'Insignia Premium en perfil'],
  });
  console.log('  ✓ Subscription: Premium para Sofía');

  // ── Welcome notifications ──────────────────────────────
  await restPost('Notification', {
    userId: owner.id, type: 'welcome', title: '🎉 Bienvenido a OmniDrive', body: 'Tus vehículos ya están publicados. ¡Empieza a recibir reservas!',
  });
  await restPost('Notification', {
    userId: tenant.id, type: 'welcome', title: '🎉 Bienvenida a OmniDrive', body: 'Tu cuenta Premium está activa. Explora los vehículos disponibles.',
  });

  console.log('\n🎉 Seed completo!');
  console.log('─────────────────────────────────────────');
  console.log('  Admin:   admin@omnidrive.ec  / Admin1234!');
  console.log('  Owner:   carlos@demo.ec      / Owner1234!');
  console.log('  Tenant:  sofia@demo.ec       / Tenant1234!');
  console.log('─────────────────────────────────────────');
}

main().catch(e => { console.error('SEED FAILED:', e); process.exit(1); });
