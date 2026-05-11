// Seed local SQLite for OmniDrive dev
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding local OmniDrive...\n');

  const now = new Date();
  const future = new Date(now);
  future.setMonth(future.getMonth() + 1);

  // ── Users ──────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@omnidrive.ec' },
    update: {},
    create: {
      authId: '00000000-0000-0000-0000-000000000001',
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
    },
  });
  console.log('  ✓ Admin:', admin.id);

  const owner = await prisma.user.upsert({
    where: { email: 'carlos@demo.ec' },
    update: {},
    create: {
      authId: '00000000-0000-0000-0000-000000000002',
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
    },
  });
  console.log('  ✓ Owner:', owner.id);

  const tenant = await prisma.user.upsert({
    where: { email: 'sofia@demo.ec' },
    update: {},
    create: {
      authId: '00000000-0000-0000-0000-000000000003',
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
    },
  });
  console.log('  ✓ Tenant:', tenant.id);

  // ── Vehicles ───────────────────────────────────────────
  const vehiclesData = [
    { brand:'Toyota',model:'Corolla',year:2023,plate:'PBG-1234',category:'car',transmission:'automatic',fuelType:'gasoline',pricePerHour:8,pricePerDay:55,deposit:100,locationLat:-0.1807,locationLng:-78.4678,locationName:'La Carolina, Quito Norte',insurance:true,seats:5,features:'["ac","bluetooth","usb","backup_camera"]',photos:'["https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800"]',color:'Blanco perla',vin:'JTDBU4EE1A9012345' },
    { brand:'Chevrolet',model:'D-MAX',year:2022,plate:'PCA-5678',category:'truck',transmission:'manual',fuelType:'diesel',pricePerHour:12,pricePerDay:80,deposit:200,locationLat:-0.2295,locationLng:-78.5243,locationName:'Valle de los Chillos',insurance:true,seats:5,features:'["ac","bluetooth"]',photos:'["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"]',color:'Gris oscuro',vin:'JACDPA12A7A067890' },
    { brand:'Yamaha',model:'MT-07',year:2023,plate:'MBG-9012',category:'motorcycle',transmission:'manual',fuelType:'gasoline',pricePerHour:5,pricePerDay:35,deposit:150,locationLat:-0.1547,locationLng:-78.4710,locationName:'Iñaquito, Quito',insurance:false,seats:2,features:'["bluetooth"]',photos:'["https://images.unsplash.com/photo-1558980394-4c7c9299fe96?w=800"]',color:'Negro mate',vin:'JYARJ18E09A012345' },
    { brand:'BMW',model:'X5',year:2022,plate:'PBH-3456',category:'luxury',transmission:'automatic',fuelType:'gasoline',pricePerHour:25,pricePerDay:180,deposit:500,locationLat:-0.1900,locationLng:-78.4850,locationName:'González Suárez, Quito',insurance:true,seats:5,features:'["ac","gps","bluetooth","usb","leather","sunroof"]',photos:'["https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800"]',color:'Negro carbón',vin:'5UXKR0C50JL012345' },
    { brand:'Kia',model:'Sportage',year:2023,plate:'PCC-7890',category:'suv',transmission:'automatic',fuelType:'gasoline',pricePerHour:10,pricePerDay:65,deposit:120,locationLat:-0.2100,locationLng:-78.5100,locationName:'Cumbayá, Quito',insurance:true,seats:5,features:'["ac","gps","bluetooth","backup_camera"]',photos:'["https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800"]',color:'Rojo pasión',vin:'KNDPM3AC8J7012345' },
    { brand:'Hyundai',model:'H1',year:2021,plate:'PBC-2345',category:'van',transmission:'automatic',fuelType:'diesel',pricePerHour:15,pricePerDay:95,deposit:250,locationLat:-0.2400,locationLng:-78.5200,locationName:'Sangolquí, Rumiñahui',insurance:true,seats:12,withDriver:true,driverPrice:35,features:'["ac","bluetooth","usb"]',photos:'["https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800"]',color:'Plata',vin:'KMHWG81JXAU012345' },
  ];

  for (const v of vehiclesData) {
    await prisma.vehicle.upsert({
      where: { plate: v.plate },
      update: {},
      create: { ...v, ownerId: owner.id },
    });
    console.log(`  ✓ Vehicle: ${v.brand} ${v.model} (${v.plate})`);
  }

  // ── Subscription ───────────────────────────────────────
  await prisma.subscription.upsert({
    where: { userId: tenant.id },
    update: {},
    create: {
      userId: tenant.id,
      tier: 'premium',
      price: 9.99,
      interval: 'monthly',
      startsAt: now,
      endsAt: future,
      status: 'active',
      benefits: '["Pagos P2P con wallet interna","Sin comision 3 reservas/mes","Soporte prioritario","Tracking GPS","Insignia Premium"]',
    },
  });
  console.log('  ✓ Subscription: Premium para Sofia');

  // ── Welcome notifications ──────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: owner.id, type: 'welcome', title: '🎉 Bienvenido a OmniDrive', body: 'Tus vehiculos ya estan publicados. Empieza a recibir reservas!' },
      { userId: tenant.id, type: 'welcome', title: '🎉 Bienvenida a OmniDrive', body: 'Tu cuenta Premium esta activa. Explora los vehiculos disponibles.' },
    ],
  });

  console.log('\n🎉 Seed local completo!');
  console.log('─────────────────────────────────────────');
  console.log('  Admin:  admin@omnidrive.ec / Admin1234!');
  console.log('  Owner:  carlos@demo.ec     / Owner1234!');
  console.log('  Tenant: sofia@demo.ec      / Tenant1234!');
  console.log('─────────────────────────────────────────');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
