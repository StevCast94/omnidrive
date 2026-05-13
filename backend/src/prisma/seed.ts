// 🚗 OmniDrive Seed Script
// Railway: npx tsx src/prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const vehicles = [
  {
    brand: 'Toyota', model: 'Hilux SRX', year: 2024,
    plate: 'PCC-1234', color: 'Azul Metálico', vin: '1HGCM82633A004352',
    category: 'truck', seats: 5, doors: 4, transmission: 'manual', fuelType: 'diesel',
    photos: ['https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&q=80'],
    pricePerHour: 18, pricePerDay: 85, deposit: 300,
    locationLat: -2.1706, locationLng: -79.9323, locationName: 'Guayaquil - Centro',
    mileage: 15000,
    features: ['4x4', 'Aire acondicionado', 'Cama doble', 'Bluetooth'],
    withDriver: true, driverPrice: 30,
    description: 'Camioneta doble cabina 4x4 ideal para trabajo o viajes. Perfecta para terrenos difíciles.',
  },
  {
    brand: 'Hyundai', model: 'Staria', year: 2026,
    plate: 'GQA-5678', color: 'Gris Titanio', vin: '5XYZU3LA1CG000002',
    category: 'van', seats: 11, doors: 4, transmission: 'automatic', fuelType: 'diesel',
    photos: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80'],
    pricePerHour: 25, pricePerDay: 120, deposit: 400,
    locationLat: -2.1895, locationLng: -79.8892, locationName: 'Guayaquil - Kennedy',
    mileage: 5000,
    features: ['Aire acondicionado', 'Asientos ejecutivos', 'Pantalla', 'Cámara 360'],
    withDriver: true, driverPrice: 40,
    description: 'Furgoneta ejecutiva 2026, ideal para grupos grandes, tours y transporte ejecutivo.',
  },
  {
    brand: 'KYC', model: 'V7', year: 2024,
    plate: 'ABC-9012', color: 'Blanco', vin: '1C4RJFBG0EC123456',
    category: 'van', seats: 11, doors: 4, transmission: 'manual', fuelType: 'gasoline',
    photos: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80'],
    pricePerHour: 15, pricePerDay: 70, deposit: 250,
    locationLat: -2.2030, locationLng: -79.9042, locationName: 'Guayaquil - Urdesa',
    mileage: 25000,
    features: ['Aire acondicionado', 'Radio', 'Asientos reclinables'],
    withDriver: false,
    description: 'Furgoneta de 11 pasajeros, económica y confiable. Ideal para paseos familiares.',
  },
  {
    brand: 'Jeep', model: 'Wrangler Sahara', year: 2023,
    plate: 'JEP-3456', color: 'Dorado', vin: '1J4FA49S3YP123456',
    category: 'suv', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
    photos: ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80'],
    pricePerHour: 20, pricePerDay: 95, deposit: 350,
    locationLat: -0.2285, locationLng: -78.5243, locationName: 'Quito - La Carolina',
    mileage: 12000,
    features: ['4x4', 'Aire acondicionado', 'Techo removible', 'Bluetooth'],
    withDriver: false,
    description: 'Jeep Wrangler 4x4, perfecto para aventuras off-road en los Andes ecuatorianos.',
  },
  {
    brand: 'Xiaomi', model: 'Ninebot Max G30', year: 2025,
    plate: 'MON-001', color: 'Naranja', vin: 'XM-MONOPATIN-001',
    category: 'motorcycle', seats: 1, doors: 0, transmission: 'automatic', fuelType: 'electric',
    photos: ['https://images.unsplash.com/photo-1558981359-219d6364c9c8?w=800&q=80'],
    pricePerHour: 5, pricePerDay: 20, deposit: 50,
    locationLat: -2.1706, locationLng: -79.9323, locationName: 'Guayaquil - Centro',
    mileage: 200,
    features: ['Eléctrico', 'Plegable', 'Freno ABS', 'Luces LED'],
    withDriver: false,
    description: 'Monopatín eléctrico urbano. Movilidad rápida y ecológica para la ciudad.',
  },
  {
    brand: 'Honda', model: 'CBR 500R', year: 2024,
    plate: 'MOT-7890', color: 'Rojo Racing', vin: '1HFSC8004A1234567',
    category: 'motorcycle', seats: 2, doors: 0, transmission: 'manual', fuelType: 'gasoline',
    photos: ['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&q=80'],
    pricePerHour: 10, pricePerDay: 45, deposit: 200,
    locationLat: -2.1855, locationLng: -79.8912, locationName: 'Guayaquil - Kennedy',
    mileage: 8000,
    features: ['ABS', 'Casco incluido', 'Seguro contra accidentes'],
    withDriver: false,
    description: 'Moto deportiva Honda CBR 500R. Potencia y estilo para los amantes de la velocidad.',
  },
  {
    brand: 'JAC', model: 'JS2', year: 2024,
    plate: 'SED-2345', color: 'Rojo Pasión', vin: 'LJ12EKS17N4700001',
    category: 'car', seats: 5, doors: 4, transmission: 'manual', fuelType: 'gasoline',
    photos: ['https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&q=80'],
    pricePerHour: 8, pricePerDay: 35, deposit: 150,
    locationLat: -2.1760, locationLng: -79.9185, locationName: 'Guayaquil - Alborada',
    mileage: 30000,
    features: ['Aire acondicionado', 'Radio', 'Cámara reversa'],
    withDriver: false,
    description: 'Sedán económico y eficiente. Perfecto para movilizarse en la ciudad.',
  },
  {
    brand: 'KIA', model: 'EV5 GT-Line', year: 2025,
    plate: 'SVE-6789', color: 'Blanco Perla', vin: 'KNAGV3457E5123456',
    category: 'luxury', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'electric',
    photos: ['https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80'],
    pricePerHour: 22, pricePerDay: 110, deposit: 500,
    locationLat: -0.1807, locationLng: -78.4678, locationName: 'Quito - Cumbayá',
    mileage: 3000,
    features: ['Eléctrico', 'Sunroof', 'Asientos de cuero', 'Asistente de conducción'],
    withDriver: false,
    description: 'SUV eléctrico de lujo. Tecnología de punta, cero emisiones, máximo confort.',
  },
];

interface OwnerInput {
  email: string;
  name: string;
  lastName: string;
  phone: string;
}

async function upsertOwner(data: OwnerInput) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    console.log(`  ℹ️  Owner ${data.email} ya existe (ID: ${existing.id.slice(0, 8)}...)`);
    return existing;
  }
  return prisma.user.create({
    data: {
      ...data,
      role: 'owner',
      identityVerified: true,
      walletBalance: Math.floor(Math.random() * 500) + 100,
      driverScore: 900 + Math.floor(Math.random() * 100),
      subscriptionTier: Math.random() > 0.8 ? 'premium' : 'free',
      authId: randomUUID(),
      documentType: 'cedula',
      documentId: `1${String(Math.floor(Math.random() * 9000000000) + 1000000000)}`,
      birthDate: new Date('1985-' + (Math.floor(Math.random() * 12) + 1) + '-' + (Math.floor(Math.random() * 28) + 1)),
      name: data.name,
      lastName: data.lastName,
    },
  });
}

async function main() {
  console.log('🌱 Seeding OmniDrive...\n');

  // === 1. Crear/registrar Owners ===
  const owners: OwnerInput[] = [
    { email: 'carlos.guerrero@email.com', name: 'Carlos', lastName: 'Guerrero', phone: '+593987654321' },
    { email: 'maria.velez@email.com',    name: 'María', lastName: 'Vélez',    phone: '+593998877665' },
  ];

  const createdOwners: any[] = [];
  for (const o of owners) createdOwners.push(await upsertOwner(o));

  // === 2. Crear un user de prueba (si no existe) ===
  const testEmail = 'test@omnidrive.ec';
  const testExists = await prisma.user.findUnique({ where: { email: testEmail } });
  if (!testExists) {
    await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Test',
        lastName: 'User',
        phone: '+593999999999',
        role: 'user',
        identityVerified: false,
        walletBalance: 200,
        driverScore: 700,
        subscriptionTier: 'free',
        authId: randomUUID(),
        documentType: 'cedula',
        documentId: `2${String(Math.floor(Math.random() * 9000000000) + 1000000000)}`,
        birthDate: new Date('1995-06-15'),
      },
    });
    console.log('  ✅ Test User (test@omnidrive.ec)');
  } else {
    console.log('  ℹ️  Test user test@omnidrive.ec ya existe');
  }

  // === 3. Crear Vehículos ===
  let created = 0;
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    const owner = createdOwners[i % createdOwners.length];

    const existing = await prisma.vehicle.findUnique({ where: { plate: v.plate } });
    if (existing) {
      console.log(`  ℹ️  ${v.brand} ${v.model} (${v.plate}) — ya existe`);
      continue;
    }

    await prisma.vehicle.create({
      data: {
        ownerId: owner.id,
        brand: v.brand,
        model: v.model,
        year: v.year,
        plate: v.plate,
        color: v.color,
        vin: v.vin,
        category: v.category,
        seats: v.seats,
        doors: v.doors,
        transmission: v.transmission,
        fuelType: v.fuelType,
        photos: v.photos,
        pricePerHour: v.pricePerHour,
        pricePerDay: v.pricePerDay,
        deposit: v.deposit,
        available: true,
        locationLat: v.locationLat,
        locationLng: v.locationLng,
        locationName: v.locationName,
        mileage: v.mileage,
        features: v.features,
        withDriver: v.withDriver,
        driverPrice: v.driverPrice || null,
        rating: parseFloat((4.3 + Math.random() * 0.7).toFixed(1)),
        totalRentals: Math.floor(Math.random() * 40) + 3,
      },
    });
    created++;
    console.log(`  🚗 ${v.brand} ${v.model} (${v.plate}) — ${v.locationName}`);
  }

  console.log(`\n✅ Seed completado! ${created} vehículos nuevos, ${vehicles.length - created} ya existían.`);
}

main()
  .catch(e => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
