/**
 * Seed Script — OmniDrive
 * ========================
 * Uso: npx tsx scripts/seed.ts
 *
 * Crea:
 *   1. Admin user (stevens@omnidrive.app) en Supabase Auth + DB
 *   2. 10 vehículos de prueba (autos, SUVs, camionetas)
 *   3. 3 usuarios inquilinos de prueba
 *   4. Reservas de ejemplo con estados variados
 *
 * Idempotente: si el admin ya existe, no duplica.
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
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

const ADMIN_EMAIL = 'stevens@omnidrive.app';
const ADMIN_PASSWORD = 'Admin2024!Secure';

const results: string[] = [];
let hasErrors = false;

function log(msg: string) {
  console.log('  •', msg);
  results.push(msg);
}

function warn(msg: string) {
  console.log('  ⚠', msg);
  results.push(`⚠ ${msg}`);
}

function err(msg: string) {
  console.log('  ✗', msg);
  results.push(`✗ ${msg}`);
  hasErrors = true;
}

// ──────────────────────────────────────────────
// 1. ADMIN USER
// ──────────────────────────────────────────────
async function seedAdmin() {
  console.log('\n── Admin ──');

  // Check if profile exists in DB
  const existingProfile = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existingProfile) {
    log(`Admin profile ya existe: ${existingProfile.name} (id: ${existingProfile.id})`);
    return existingProfile;
  }

  // Check if user exists in Supabase Auth
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const existingAuth = authUsers?.users.find(u => u.email === ADMIN_EMAIL);

  let authId: string;

  if (existingAuth) {
    log(`Admin ya existe en Auth (id: ${existingAuth.id})`);
    authId = existingAuth.id;
  } else {
    // Create in Supabase Auth
    const { data: newUser, error: authErr } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Stevens', role: 'admin' },
    });

    if (authErr) {
      err(`Error creando admin en Auth: ${authErr.message}`);
      return null;
    }

    authId = newUser!.user.id;
    log(`Admin creado en Auth (id: ${authId})`);
  }

  // Create profile in Prisma DB
  const admin = await prisma.user.create({
    data: {
      authId,
      email: ADMIN_EMAIL,
      phone: '+593999000001',
      name: 'Stevens',
      lastName: 'Admin',
      role: 'admin',
      identityVerified: true,
      verifiedAt: new Date(),
      walletBalance: 1000,
      driverScore: 1000,
      totalTrips: 0,
      subscriptionTier: 'free',
      documentType: 'cedula',
      documentId: '0900000001',
      birthDate: new Date('1990-01-15'),
    },
  });

  log(`Admin profile creado en DB (id: ${admin.id})`);
  log(`  Email: ${ADMIN_EMAIL} / Password: ${ADMIN_PASSWORD}`);

  return admin;
}

// ──────────────────────────────────────────────
// 2. VEHICLES (10 de prueba)
// ──────────────────────────────────────────────
async function seedVehicles(ownerId: string) {
  console.log('\n── Vehículos ──');

  const vehicles = [
    {
      brand: 'Chevrolet', model: 'Sail LT', year: 2023,
      plate: 'GCL-1001', color: 'Blanco', vin: 'CHEV-SAIL-001',
      category: 'car', seats: 5, doors: 4, transmission: 'manual', fuelType: 'gasoline',
      photos: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80'],
      pricePerHour: 6, pricePerDay: 30, deposit: 150,
      locationLat: -2.1706, locationLng: -79.9323, locationName: 'Guayaquil - Centro',
      mileage: 45000, features: ['Aire acondicionado', 'Dirección hidráulica', 'Radio Bluetooth'],
      withDriver: false,
    },
    {
      brand: 'Toyota', model: 'Yaris S', year: 2024,
      plate: 'GCL-1002', color: 'Gris Plata', vin: 'TOY-YARIS-002',
      category: 'car', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
      photos: ['https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&q=80'],
      pricePerHour: 8, pricePerDay: 40, deposit: 200,
      locationLat: -2.1760, locationLng: -79.9185, locationName: 'Guayaquil - Alborada',
      mileage: 22000, features: ['Aire acondicionado', 'Cámara reversa', 'Pantalla táctil', 'ABS'],
      withDriver: false,
    },
    {
      brand: 'Hyundai', model: 'Tucson GL', year: 2024,
      plate: 'GCL-1003', color: 'Azul Oscuro', vin: 'HYU-TUCSON-003',
      category: 'suv', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
      photos: ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80'],
      pricePerHour: 12, pricePerDay: 60, deposit: 300,
      locationLat: -0.2285, locationLng: -78.5243, locationName: 'Quito - La Carolina',
      mileage: 18000, features: ['Aire acondicionado', 'Sunroof', 'Sensores de parqueo', 'Bluetooth'],
      withDriver: false,
    },
    {
      brand: 'Mazda', model: 'CX-5 Touring', year: 2025,
      plate: 'GCL-1004', color: 'Rojo Soul', vin: 'MAZ-CX5-004',
      category: 'suv', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
      photos: ['https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80'],
      pricePerHour: 15, pricePerDay: 75, deposit: 350,
      locationLat: -2.1895, locationLng: -79.8892, locationName: 'Guayaquil - Kennedy',
      mileage: 12000, features: ['Aire acondicionado', 'Asientos de cuero', 'Cámara 360', 'Apple CarPlay'],
      withDriver: false,
    },
    {
      brand: 'Ford', model: 'Ranger XLT', year: 2023,
      plate: 'GCL-1005', color: 'Negro', vin: 'FORD-RANGER-005',
      category: 'truck', seats: 5, doors: 4, transmission: 'manual', fuelType: 'diesel',
      photos: ['https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&q=80'],
      pricePerHour: 18, pricePerDay: 85, deposit: 400,
      locationLat: -2.2030, locationLng: -79.9042, locationName: 'Guayaquil - Urdesa',
      mileage: 35000, features: ['4x4', 'Aire acondicionado', 'Cama doble', 'Bluetooth'],
      withDriver: true, driverPrice: 30,
    },
    {
      brand: 'Chevrolet', model: 'D-Max', year: 2024,
      plate: 'GCL-1006', color: 'Blanco', vin: 'CHEV-DMAX-006',
      category: 'truck', seats: 5, doors: 4, transmission: 'manual', fuelType: 'diesel',
      photos: ['https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&q=80'],
      pricePerHour: 16, pricePerDay: 80, deposit: 350,
      locationLat: -2.1706, locationLng: -79.9323, locationName: 'Guayaquil - Centro',
      mileage: 28000, features: ['4x4', 'Aire acondicionado', 'Cama simple'],
      withDriver: false,
    },
    {
      brand: 'Volkswagen', model: 'Golf GTI', year: 2025,
      plate: 'GCL-1007', color: 'Azul Racing', vin: 'VW-GOLF-007',
      category: 'car', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
      photos: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80'],
      pricePerHour: 10, pricePerDay: 50, deposit: 250,
      locationLat: -0.1807, locationLng: -78.4678, locationName: 'Quito - Cumbayá',
      mileage: 8000, features: ['Turbo', 'Asientos deportivos', 'Pantalla digital', 'Sensores'],
      withDriver: false,
    },
    {
      brand: 'KIA', model: 'Sportage EX', year: 2024,
      plate: 'GCL-1008', color: 'Gris Titanio', vin: 'KIA-SPORTAGE-008',
      category: 'suv', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
      photos: ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80'],
      pricePerHour: 11, pricePerDay: 55, deposit: 280,
      locationLat: -2.8760, locationLng: -78.9930, locationName: 'Cuenca - El Centro',
      mileage: 15000, features: ['Aire acondicionado', 'Cámara reversa', 'Bluetooth', 'Android Auto'],
      withDriver: false,
    },
    {
      brand: 'Nissan', model: 'Sentra SR', year: 2024,
      plate: 'GCL-1009', color: 'Blanco Perla', vin: 'NIS-SENTRA-009',
      category: 'car', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
      photos: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80'],
      pricePerHour: 7, pricePerDay: 35, deposit: 180,
      locationLat: -0.9700, locationLng: -80.7300, locationName: 'Manta - Playita Mía',
      mileage: 32000, features: ['Aire acondicionado', 'Bluetooth', 'Cámara reversa'],
      withDriver: false,
    },
    {
      brand: 'Toyota', model: 'Fortuner SRV', year: 2025,
      plate: 'GCL-1010', color: 'Gris Oscuro', vin: 'TOY-FORTUNER-010',
      category: 'suv', seats: 7, doors: 4, transmission: 'automatic', fuelType: 'diesel',
      photos: ['https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80'],
      pricePerHour: 22, pricePerDay: 110, deposit: 500,
      locationLat: -2.1706, locationLng: -79.9323, locationName: 'Guayaquil - Centro',
      mileage: 5000, features: ['4x4', 'Aire acondicionado', '7 asientos', 'Cámara 360', 'Sunroof', 'GPS'],
      withDriver: true, driverPrice: 35,
    },
  ];

  let created = 0, skipped = 0;

  for (const v of vehicles) {
    const existing = await prisma.vehicle.findUnique({ where: { plate: v.plate } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.vehicle.create({
      data: {
        ownerId,
        available: true,
        rating: parseFloat((4.3 + Math.random() * 0.7).toFixed(1)),
        totalRentals: Math.floor(Math.random() * 30) + 1,
        ...v,
      },
    });
    created++;
    log(`${v.brand} ${v.model} (${v.plate}) — $${v.pricePerDay}/día — ${v.locationName}`);
  }

  log(`${created} vehículos creados, ${skipped} ya existían.`);
}

// ──────────────────────────────────────────────
// 3. TEST TENANTS (3 inquilinos)
// ──────────────────────────────────────────────
async function seedTenants() {
  console.log('\n── Inquilinos de prueba ──');

  const tenants = [
    {
      email: 'ana.lopez@example.com',
      phone: '+593998000001',
      name: 'Ana',
      lastName: 'López',
      documentId: '0900000101',
    },
    {
      email: 'pedro.martinez@example.com',
      phone: '+593998000002',
      name: 'Pedro',
      lastName: 'Martínez',
      documentId: '0900000102',
    },
    {
      email: 'sofia.ramirez@example.com',
      phone: '+593998000003',
      name: 'Sofía',
      lastName: 'Ramírez',
      documentId: '0900000103',
    },
  ];

  const createdTenants: any[] = [];

  for (const t of tenants) {
    let user = await prisma.user.findUnique({ where: { email: t.email } });
    if (user) {
      log(`${t.name} ${t.lastName} ya existe (id: ${user.id})`);
      createdTenants.push(user);
      continue;
    }

    // Create in Supabase Auth
    const { data: newUser, error: authErr } = await supabase.auth.admin.createUser({
      email: t.email,
      password: 'TestPass123!',
      email_confirm: true,
      user_metadata: { name: t.name },
    });

    if (authErr) {
      err(`Error creando ${t.email} en Auth: ${authErr.message}`);
      continue;
    }

    user = await prisma.user.create({
      data: {
        authId: newUser!.user.id,
        email: t.email,
        phone: t.phone,
        name: t.name,
        lastName: t.lastName,
        role: 'user',
        identityVerified: false,
        walletBalance: 500,
        driverScore: 750 + Math.floor(Math.random() * 100),
        totalTrips: Math.floor(Math.random() * 8) + 1,
        subscriptionTier: Math.random() > 0.7 ? 'premium' : 'free',
        documentType: 'cedula',
        documentId: t.documentId,
        birthDate: new Date('1995-' + String(Math.floor(Math.random() * 12) + 1).padStart(2, '0') + '-15'),
      },
    });

    log(`${t.name} ${t.lastName} creado (email: ${t.email} / pass: TestPass123!)`);
    createdTenants.push(user);
  }

  return createdTenants;
}

// ──────────────────────────────────────────────
// 4. SAMPLE BOOKINGS
// ──────────────────────────────────────────────
async function seedBookings(adminId: string, tenantIds: string[]) {
  console.log('\n── Reservas de ejemplo ──');

  // Get some vehicles
  const vehicles = await prisma.vehicle.findMany({ take: 5, orderBy: { createdAt: 'asc' } });
  if (vehicles.length === 0) {
    warn('No hay vehículos para crear reservas. Primero ejecuta seedVehicles.');
    return;
  }

  const today = new Date();
  const bookingTemplates = [
    { daysOffset: -30, daysDuration: 3, status: 'completed' as const },
    { daysOffset: -20, daysDuration: 2, status: 'completed' as const },
    { daysOffset: -10, daysDuration: 5, status: 'completed' as const },
    { daysOffset: 2,   daysDuration: 4, status: 'confirmed' as const },
    { daysOffset: 7,   daysDuration: 3, status: 'confirmed' as const },
  ];

  let created = 0;

  for (let i = 0; i < bookingTemplates.length; i++) {
    const tmpl = bookingTemplates[i];
    const vehicle = vehicles[i % vehicles.length];
    const tenantId = tenantIds[i % tenantIds.length];

    const startAt = new Date(today);
    startAt.setDate(startAt.getDate() + tmpl.daysOffset);
    startAt.setHours(10, 0, 0, 0);

    const endAt = new Date(startAt);
    endAt.setDate(endAt.getDate() + tmpl.daysDuration);
    endAt.setHours(18, 0, 0, 0);

    // Check for duplicate bookings (same vehicle, overlapping dates)
    const existing = await prisma.booking.findFirst({
      where: {
        vehicleId: vehicle.id,
        tenantId,
        startAt: { gte: startAt },
      },
    });
    if (existing) {
      continue;
    }

    const days = tmpl.daysDuration;
    const dailyRate = Number(vehicle.pricePerDay);
    const baseAmount = dailyRate * days;
    const serviceFee = parseFloat((baseAmount * 0.15).toFixed(2));
    const deposit = Number(vehicle.deposit);
    const totalAmount = baseAmount + serviceFee;
    const driverFee = vehicle.withDriver ? Number(vehicle.driverPrice ?? 0) * days : 0;

    await prisma.booking.create({
      data: {
        vehicleId: vehicle.id,
        tenantId,
        startAt,
        endAt,
        status: tmpl.status,
        baseAmount,
        driverFee,
        insuranceFee: 0,
        serviceFee,
        deposit,
        totalAmount: totalAmount + driverFee,
        paymentStatus: tmpl.status === 'completed' ? 'released' : 'held',
        hasInsurance: false,
        liabilityWaiver: false,
        trackingEnabled: false,
        withDriver: vehicle.withDriver,
        createdAt: new Date(today.getTime() - Math.abs(tmpl.daysOffset) * 24 * 60 * 60 * 1000),
      },
    });

    created++;
    const locale = 'es-EC';
    log(`${vehicle.brand} ${vehicle.model} — ${startAt.toLocaleDateString(locale)} → ${endAt.toLocaleDateString(locale)} — $${totalAmount.toFixed(2)} — ${tmpl.status}`);
  }

  log(`${created} reservas creadas.`);
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  OmniDrive — Seed Data');
  console.log('═══════════════════════════════════════\n');

  try {
    // 1. Admin
    const admin = await seedAdmin();
    if (!admin) {
      err('No se pudo crear/obtener el admin. Abortando.');
      printSummary();
      process.exit(1);
    }

    // 2. Vehicles (owner = admin)
    await seedVehicles(admin.id);

    // 3. Tenants
    const tenants = await seedTenants();
    const tenantIds = tenants.filter(Boolean).map(t => t.id);

    // 4. Bookings
    if (tenantIds.length > 0) {
      await seedBookings(admin.id, tenantIds);
    } else {
      warn('No hay inquilinos disponibles. Omitiendo reservas.');
    }

    printSummary();
  } catch (e: any) {
    console.error('\n[FATAL]', e);
    hasErrors = true;
    printSummary();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function printSummary() {
  console.log('\n═══════════════════════════════════════');
  console.log('  Resumen');
  console.log('═══════════════════════════════════════');
  results.forEach(r => console.log(r));
  console.log('───────────────────────────────────────');
  if (hasErrors) {
    console.log('  ⚠ Completado con errores');
    process.exit(1);
  } else {
    console.log('  ✅ Seed completado exitosamente');
  }
}

main();
