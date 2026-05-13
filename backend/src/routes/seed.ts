import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

// Seed data endpoint: GET /api/seed
// Ejecuta la siembra de datos de prueba
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Dynamic import to avoid pulling prisma on normal app load
    const { prisma } = await import('../lib/prisma');
    
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
      },
    ];

    const results: string[] = [];
    
    // Create owners
    const ownerData = [
      { email: 'carlos.guerrero@email.com', name: 'Carlos', lastName: 'Guerrero', phone: '+593987654321' },
      { email: 'maria.velez@email.com', name: 'María', lastName: 'Vélez', phone: '+593998877665' },
    ];

    const owners: any[] = [];
    for (const od of ownerData) {
      let u = await prisma.user.findUnique({ where: { email: od.email } });
      if (!u) {
        const uuid = crypto.randomUUID();
        u = await prisma.user.create({
          data: {
            ...od, role: 'owner', identityVerified: true,
            walletBalance: 250, driverScore: 920,
            subscriptionTier: 'free',
            authId: uuid,
            documentType: 'cedula',
            documentId: '1' + Math.floor(1000000000 + Math.random() * 9000000000),
            birthDate: new Date('1985-06-15'),
          },
        });
        results.push(`Owner creado: ${od.name} ${od.lastName}`);
      } else {
        results.push(`Owner ya existe: ${od.name} ${od.lastName}`);
      }
      owners.push(u);
    }

    // Create vehicles
    let created = 0, skipped = 0;
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const owner = owners[i % owners.length];
      
      const existing = await prisma.vehicle.findUnique({ where: { plate: v.plate } });
      if (existing) { skipped++; continue; }
      
      await prisma.vehicle.create({
        data: {
          ownerId: owner.id, available: true,
          rating: parseFloat((4.3 + Math.random() * 0.7).toFixed(1)),
          totalRentals: Math.floor(Math.random() * 40) + 3,
          ...v,
        },
      });
      created++;
    }

    results.push(`${created} vehículos creados, ${skipped} ya existían.`);
    
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export { router as seedRouter };
