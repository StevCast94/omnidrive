"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vehiclesRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const storage_1 = require("../lib/storage");
const asyncHandler_1 = require("../middleware/asyncHandler");
const zod_1 = require("zod");
// Campos que el dueño puede editar. Lista blanca explícita:
// NO incluye ownerId, insurance, rating, totalRentals, plate, vin (inmutables/privilegiados).
const vehicleUpdateSchema = zod_1.z.object({
    brand: zod_1.z.string().min(1).optional(),
    model: zod_1.z.string().min(1).optional(),
    year: zod_1.z.coerce.number().int().optional(),
    color: zod_1.z.string().min(1).optional(),
    category: zod_1.z.string().min(1).optional(),
    seats: zod_1.z.coerce.number().int().optional(),
    doors: zod_1.z.coerce.number().int().optional(),
    transmission: zod_1.z.string().optional(),
    fuelType: zod_1.z.string().optional(),
    pricePerHour: zod_1.z.coerce.number().optional(),
    pricePerDay: zod_1.z.coerce.number().optional(),
    pricePerKm: zod_1.z.coerce.number().optional(),
    deposit: zod_1.z.coerce.number().optional(),
    available: zod_1.z.boolean().optional(),
    locationLat: zod_1.z.coerce.number().optional(),
    locationLng: zod_1.z.coerce.number().optional(),
    locationName: zod_1.z.string().optional(),
    withDriver: zod_1.z.boolean().optional(),
    driverPrice: zod_1.z.coerce.number().optional(),
    flexibleCheckin: zod_1.z.boolean().optional(),
    checkInTime: zod_1.z.string().nullable().optional(),
    checkOutTime: zod_1.z.string().nullable().optional(),
    mileage: zod_1.z.coerce.number().int().optional(),
    features: zod_1.z.array(zod_1.z.string()).optional(),
    restrictions: zod_1.z.any().optional(),
}); // modo "strip" (por defecto): descarta silenciosamente campos no permitidos como ownerId, insurance, rating
exports.vehiclesRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
// Haversine distance in km
function distKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// GET /api/vehicles
exports.vehiclesRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { category, lat, lng, radius = 50, startAt, endAt, minPrice, maxPrice, withDriver, features, sort = 'rating_desc', } = req.query;
    const where = { available: true };
    if (category)
        where.category = { in: category.split(',') };
    if (withDriver === 'true')
        where.withDriver = true;
    if (minPrice || maxPrice) {
        where.pricePerDay = {};
        if (minPrice)
            where.pricePerDay.gte = parseFloat(minPrice);
        if (maxPrice)
            where.pricePerDay.lte = parseFloat(maxPrice);
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
    let vehicles = await prisma_1.prisma.vehicle.findMany({
        where,
        include: {
            owner: { select: { id: true, name: true, lastName: true, phone: true, rating: true, totalTrips: true } },
            _count: { select: { reviews: true } },
        },
    });
    if (lat && lng) {
        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);
        const r = parseFloat(radius);
        vehicles = vehicles
            .filter(v => v.locationLat && v.locationLng && distKm(userLat, userLng, v.locationLat, v.locationLng) <= r)
            .map(v => ({ ...v, distance: distKm(userLat, userLng, v.locationLat, v.locationLng) }));
    }
    if (features) {
        const fArr = features.split(',');
        vehicles = vehicles.filter(v => fArr.every(f => v.features.includes(f)));
    }
    vehicles.sort((a, b) => {
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
exports.vehiclesRouter.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const vehicle = await prisma_1.prisma.vehicle.findUnique({
        where: { id: req.params.id },
        include: {
            owner: { select: { id: true, name: true, lastName: true, phone: true, rating: true, totalTrips: true, identityVerified: true, createdAt: true } },
            reviews: { include: { author: { select: { id: true, name: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 10 },
        },
    });
    if (!vehicle)
        return res.status(404).json({ data: null, error: 'Vehicle not found' });
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const bookings = await prisma_1.prisma.booking.findMany({
        where: {
            vehicleId: req.params.id,
            status: { in: ['confirmed', 'active'] },
            startAt: { lte: in30 },
            endAt: { gte: now },
        },
        select: { startAt: true, endAt: true },
    });
    return res.json({ data: { ...vehicle, occupiedDates: bookings }, error: null });
}));
// POST /api/vehicles
exports.vehiclesRouter.post('/', auth_1.authenticate, auth_1.requireVerified, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { brand, model, year, plate, color, vin, category, seats, doors, transmission, fuelType, pricePerHour, pricePerDay, pricePerKm, deposit, locationLat, locationLng, locationName, withDriver, driverPrice, insurance, features, restrictions, flexibleCheckin, checkInTime, checkOutTime, } = req.body;
    const required = [brand, model, year, plate, color, vin, category, seats, transmission, fuelType, pricePerHour, pricePerDay];
    if (required.some(v => v === undefined || v === null)) {
        return res.status(400).json({ data: null, error: 'Missing required vehicle fields' });
    }
    const vehicle = await prisma_1.prisma.vehicle.create({
        data: {
            ownerId: req.user.id,
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
const requireVehicleOwner = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const vehicle = await prisma_1.prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle)
        return res.status(404).json({ data: null, error: 'Vehicle not found' });
    if (vehicle.ownerId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ data: null, error: 'Not authorized' });
    }
    return vehicle;
});
// PUT /api/vehicles/:id
exports.vehiclesRouter.put('/:id', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await requireVehicleOwner(req, res);
    if (res.headersSent)
        return;
    // Permitir features como string JSON (compatibilidad con multipart)
    const raw = { ...req.body };
    if (raw.features && typeof raw.features === 'string') {
        try {
            raw.features = JSON.parse(raw.features);
        }
        catch { /* dejar fallar la validación */ }
    }
    const parsed = vehicleUpdateSchema.safeParse(raw);
    if (!parsed.success) {
        return res.status(400).json({ data: null, error: 'Campos invalidos o no permitidos', details: parsed.error.flatten().fieldErrors });
    }
    const updated = await prisma_1.prisma.vehicle.update({
        where: { id: req.params.id },
        data: parsed.data,
    });
    return res.json({ data: updated, error: null });
}));
// DELETE /api/vehicles/:id
exports.vehiclesRouter.delete('/:id', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await requireVehicleOwner(req, res);
    if (res.headersSent)
        return;
    await prisma_1.prisma.vehicle.delete({ where: { id: req.params.id } });
    return res.json({ data: { deleted: true }, error: null });
}));
// POST /api/vehicles/:id/photos
exports.vehiclesRouter.post('/:id/photos', auth_1.authenticate, upload.array('photos', 10), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const vehicle = await prisma_1.prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle)
        return res.status(404).json({ data: null, error: 'Vehicle not found' });
    if (vehicle.ownerId !== req.user.id)
        return res.status(403).json({ data: null, error: 'Not authorized' });
    const files = req.files;
    if (!files?.length)
        return res.status(400).json({ data: null, error: 'No files uploaded' });
    const urls = await Promise.all(files.map((f, i) => (0, storage_1.uploadToStorage)(`vehicles/${req.params.id}/photo-${Date.now()}-${i}`, f)));
    const updated = await prisma_1.prisma.vehicle.update({
        where: { id: req.params.id },
        data: { photos: { push: urls } },
    });
    return res.json({ data: { photos: updated.photos }, error: null });
}));
// PUT /api/vehicles/:id/availability
exports.vehiclesRouter.put('/:id/availability', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const vehicle = await prisma_1.prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle)
        return res.status(404).json({ data: null, error: 'Vehicle not found' });
    if (vehicle.ownerId !== req.user.id)
        return res.status(403).json({ data: null, error: 'Not authorized' });
    const updated = await prisma_1.prisma.vehicle.update({
        where: { id: req.params.id },
        data: { available: req.body.available },
    });
    return res.json({ data: { available: updated.available }, error: null });
}));
//# sourceMappingURL=vehicles.js.map