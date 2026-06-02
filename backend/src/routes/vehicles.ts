import { Router, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticate, requireVerified, AuthRequest } from '../middleware/auth';
import { uploadToStorage } from '../lib/storage';
import { asyncHandler } from '../middleware/asyncHandler';
import { z } from 'zod';

// Campos que el dueño puede editar. Lista blanca explícita:
// NO incluye ownerId, insurance, rating, totalRentals, plate, vin (inmutables/privilegiados).
const vehicleUpdateSchema = z.object({
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.coerce.number().int().optional(),
  color: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  seats: z.coerce.number().int().optional(),
  doors: z.coerce.number().int().optional(),
  transmission: z.string().optional(),
  fuelType: z.string().optional(),
  pricePerHour: z.coerce.number().optional(),
  pricePerDay: z.coerce.number().optional(),
  pricePerKm: z.coerce.number().optional(),
  deposit: z.coerce.number().optional(),
  available: z.boolean().optional(),
  locationLat: z.coerce.number().optional(),
  locationLng: z.coerce.number().optional(),
  locationName: z.string().optional(),
  withDriver: z.boolean().optional(),
  driverPrice: z.coerce.number().optional(),
  flexibleCheckin: z.boolean().optional(),
  checkInTime: z.string().nullable().optional(),
  checkOutTime: z.string().nullable().optional(),
  mileage: z.coerce.number().int().optional(),
  features: z.array(z.string()).optional(),
  restrictions: z.any().optional(),
}); // modo "strip" (por defecto): descarta silenciosamente campos no permitidos como ownerId, insurance, rating

export const vehiclesRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Haversine distance in km
function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/vehicles
vehiclesRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    category, lat, lng, radius = 50, startAt, endAt,
    minPrice, maxPrice, withDriver, features, sort = 'rating_desc',
  } = req.query as Record<string, string>;

  const where: any = { available: true };

  if (category) where.category = { in: category.split(',') };
  if (withDriver === 'true') where.withDriver = true;
  if (minPrice || maxPrice) {
    where.pricePerDay = {};
    if (minPrice) where.pricePerDay.gte = parseFloat(minPrice);
    if (maxPrice) where.pricePerDay.lte = parseFloat(maxPrice);
  }

  if (startAt && endAt) {
    where.bookings = {
      none: {
        status: { in: ['confirmed', 'active'] },
        AND: [
          { startAt: { lt: new Date(endAt) } },
          { endAt: { gt: new Date(startAt) } },
        ],
      },
    };
  }

  let vehicles = await prisma.vehicle.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, lastName: true, phone: true, rating: true, totalTrips: true } },
      _count: { select: { reviews: true } },
    },
  });

  if (lat && lng) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const r = parseFloat(radius as string);
    vehicles = vehicles
      .filter(v => v.locationLat && v.locationLng && distKm(userLat, userLng, v.locationLat, v.locationLng) <= r)
      .map(v => ({ ...v, distance: distKm(userLat, userLng, v.locationLat!, v.locationLng!) }));
  }

  if (features) {
    const fArr = features.split(',');
    vehicles = vehicles.filter(v => fArr.every(f => v.features.includes(f)));
  }

  vehicles.sort((a: any, b: any) => {
    switch (sort) {
      case 'price_asc': return Number(a.pricePerDay) - Number(b.pricePerDay);
      case 'price_desc': return Number(b.pricePerDay) - Number(a.pricePerDay);
      case 'distance': return (a.distance ?? 9999) - (b.distance ?? 9999);
      default: return b.rating - a.rating;
    }
  });

  return res.json({ data: vehicles, error: null });
}));

// GET /api/vehicles/:id
vehiclesRouter.get('/:id', asyncHandler(async (req, res: Response) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: req.params.id as string },
    include: {
      owner: { select: { id: true, name: true, lastName: true, phone: true, rating: true, totalTrips: true, identityVerified: true, createdAt: true } },
      reviews: { include: { author: { select: { id: true, name: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!vehicle) return res.status(404).json({ data: null, error: 'Vehicle not found' });

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const bookings = await prisma.booking.findMany({
    where: {
      vehicleId: req.params.id as string,
      status: { in: ['confirmed', 'active'] },
      startAt: { lte: in30 },
      endAt: { gte: now },
    },
    select: { startAt: true, endAt: true },
  });

  return res.json({ data: { ...vehicle, occupiedDates: bookings }, error: null });
}));

// POST /api/vehicles
vehiclesRouter.post('/', authenticate, requireVerified, asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    brand, model, year, plate, color, vin, category, seats, doors,
    transmission, fuelType, pricePerHour, pricePerDay, pricePerKm,
    deposit, locationLat, locationLng, locationName, withDriver,
    driverPrice, insurance, features, restrictions,
    flexibleCheckin, checkInTime, checkOutTime,
  } = req.body;

  const required = [brand, model, year, plate, color, vin, category, seats, transmission, fuelType, pricePerHour, pricePerDay];
  if (required.some(v => v === undefined || v === null)) {
    return res.status(400).json({ data: null, error: 'Missing required vehicle fields' });
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      ownerId: req.user!.id,
      brand, model, year: parseInt(year), plate, color, vin,
      category, seats: parseInt(seats), doors: doors ? parseInt(doors) : undefined,
      transmission, fuelType,
      pricePerHour: parseFloat(pricePerHour),
      pricePerDay: parseFloat(pricePerDay),
      pricePerKm: pricePerKm ? parseFloat(pricePerKm) : undefined,
      deposit: deposit ? parseFloat(deposit) : 0,
      locationLat: locationLat ? parseFloat(locationLat) : undefined,
      locationLng: locationLng ? parseFloat(locationLng) : undefined,
      locationName,
      withDriver: Boolean(withDriver),
      driverPrice: driverPrice ? parseFloat(driverPrice) : undefined,
      insurance: Boolean(insurance),
      features: features || [],
      restrictions: restrictions || undefined,
      flexibleCheckin: flexibleCheckin !== undefined ? Boolean(flexibleCheckin) : true,
      checkInTime: flexibleCheckin ? undefined : checkInTime || null,
      checkOutTime: flexibleCheckin ? undefined : checkOutTime || null,
    },
  });
  return res.status(201).json({ data: vehicle, error: null });
}));

// Middleware: check vehicle ownership
const requireVehicleOwner = asyncHandler(async (req: AuthRequest, res: Response) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id as string } });
  if (!vehicle) return res.status(404).json({ data: null, error: 'Vehicle not found' });
  if (vehicle.ownerId !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ data: null, error: 'Not authorized' });
  }
  return vehicle;
});

// PUT /api/vehicles/:id
vehiclesRouter.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  await requireVehicleOwner(req, res);
  if (res.headersSent) return;

  // Permitir features como string JSON (compatibilidad con multipart)
  const raw = { ...req.body };
  if (raw.features && typeof raw.features === 'string') {
    try { raw.features = JSON.parse(raw.features); } catch { /* dejar fallar la validación */ }
  }

  const parsed = vehicleUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return res.status(400).json({ data: null, error: 'Campos invalidos o no permitidos', details: parsed.error.flatten().fieldErrors });
  }

  const updated = await prisma.vehicle.update({
    where: { id: req.params.id as string },
    data: parsed.data,
  });
  return res.json({ data: updated, error: null });
}));

// DELETE /api/vehicles/:id
vehiclesRouter.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  await requireVehicleOwner(req, res);
  if (res.headersSent) return;

  await prisma.vehicle.delete({ where: { id: req.params.id as string } });
  return res.json({ data: { deleted: true }, error: null });
}));

// POST /api/vehicles/:id/photos
vehiclesRouter.post('/:id/photos', authenticate, upload.array('photos', 10), asyncHandler(async (req: AuthRequest, res: Response) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id as string } });
  if (!vehicle) return res.status(404).json({ data: null, error: 'Vehicle not found' });
  if (vehicle.ownerId !== req.user!.id) return res.status(403).json({ data: null, error: 'Not authorized' });

  const files = req.files as Express.Multer.File[];
  if (!files?.length) return res.status(400).json({ data: null, error: 'No files uploaded' });

  const urls = await Promise.all(
    files.map((f, i) => uploadToStorage(`vehicles/${req.params.id as string}/photo-${Date.now()}-${i}`, f))
  );
  const updated = await prisma.vehicle.update({
    where: { id: req.params.id as string },
    data: { photos: { push: urls } },
  });
  return res.json({ data: { photos: updated.photos }, error: null });
}));

// PUT /api/vehicles/:id/availability
vehiclesRouter.put('/:id/availability', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id as string } });
  if (!vehicle) return res.status(404).json({ data: null, error: 'Vehicle not found' });
  if (vehicle.ownerId !== req.user!.id) return res.status(403).json({ data: null, error: 'Not authorized' });

  const updated = await prisma.vehicle.update({
    where: { id: req.params.id as string },
    data: { available: req.body.available },
  });
  return res.json({ data: { available: updated.available }, error: null });
}));

