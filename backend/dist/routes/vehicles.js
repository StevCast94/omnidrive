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
exports.vehiclesRouter.get('/', async (req, res) => {
    const { category, lat, lng, radius = 50, startAt, endAt, minPrice, maxPrice, withDriver, features, sort = 'rating_desc', } = req.query;
    try {
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
        // Exclude vehicles with overlapping confirmed/active bookings
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
                owner: { select: { id: true, name: true, lastName: true, phone: true, driverScore: true, totalTrips: true } },
                _count: { select: { reviews: true } },
            },
        });
        // Filter by radius
        if (lat && lng) {
            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);
            const r = parseFloat(radius);
            vehicles = vehicles
                .filter(v => v.locationLat && v.locationLng && distKm(userLat, userLng, v.locationLat, v.locationLng) <= r)
                .map(v => ({ ...v, distance: distKm(userLat, userLng, v.locationLat, v.locationLng) }));
        }
        // Filter by features
        if (features) {
            const fArr = features.split(',');
            vehicles = vehicles.filter(v => fArr.every(f => v.features.includes(f)));
        }
        // Sort
        vehicles.sort((a, b) => {
            switch (sort) {
                case 'price_asc': return Number(a.pricePerDay) - Number(b.pricePerDay);
                case 'price_desc': return Number(b.pricePerDay) - Number(a.pricePerDay);
                case 'distance': return (a.distance ?? 9999) - (b.distance ?? 9999);
                default: return b.rating - a.rating; // rating_desc
            }
        });
        return res.json({ data: vehicles, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// GET /api/vehicles/:id
exports.vehiclesRouter.get('/:id', async (req, res) => {
    try {
        const vehicle = await prisma_1.prisma.vehicle.findUnique({
            where: { id: req.params.id },
            include: {
                owner: { select: { id: true, name: true, lastName: true, phone: true, driverScore: true, totalTrips: true, identityVerified: true, createdAt: true } },
                reviews: { include: { author: { select: { id: true, name: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 10 },
            },
        });
        if (!vehicle)
            return res.status(404).json({ data: null, error: 'Vehicle not found' });
        // Occupied dates in next 30 days
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
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// POST /api/vehicles
exports.vehiclesRouter.post('/', auth_1.authenticate, auth_1.requireVerified, async (req, res) => {
    const { brand, model, year, plate, color, vin, category, seats, doors, transmission, fuelType, pricePerHour, pricePerDay, pricePerKm, deposit, locationLat, locationLng, locationName, withDriver, driverPrice, insurance, features, restrictions, flexibleCheckin, checkInTime, checkOutTime, } = req.body;
    const required = [brand, model, year, plate, color, vin, category, seats, transmission, fuelType, pricePerHour, pricePerDay];
    if (required.some(v => v === undefined || v === null))
        return res.status(400).json({ data: null, error: 'Missing required vehicle fields' });
    try {
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
    }
    catch (e) {
        if (e.code === 'P2002')
            return res.status(409).json({ data: null, error: 'Plate or VIN already registered' });
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/vehicles/:id
exports.vehiclesRouter.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const vehicle = await prisma_1.prisma.vehicle.findUnique({ where: { id: req.params.id } });
        if (!vehicle)
            return res.status(404).json({ data: null, error: 'Vehicle not found' });
        if (vehicle.ownerId !== req.user.id && req.user.role !== 'admin')
            return res.status(403).json({ data: null, error: 'Not authorized' });
        const data = { ...req.body };
        // Parse numeric fields
        if (data.year)
            data.year = parseInt(data.year);
        if (data.seats)
            data.seats = parseInt(data.seats);
        if (data.doors)
            data.doors = parseInt(data.doors);
        if (data.pricePerHour)
            data.pricePerHour = parseFloat(data.pricePerHour);
        if (data.pricePerDay)
            data.pricePerDay = parseFloat(data.pricePerDay);
        if (data.pricePerKm)
            data.pricePerKm = parseFloat(data.pricePerKm);
        if (data.deposit)
            data.deposit = parseFloat(data.deposit);
        if (data.driverPrice)
            data.driverPrice = parseFloat(data.driverPrice);
        if (data.features && typeof data.features === 'string')
            data.features = JSON.parse(data.features);
        const updated = await prisma_1.prisma.vehicle.update({
            where: { id: req.params.id },
            data,
        });
        return res.json({ data: updated, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// DELETE /api/vehicles/:id
exports.vehiclesRouter.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const vehicle = await prisma_1.prisma.vehicle.findUnique({ where: { id: req.params.id } });
        if (!vehicle)
            return res.status(404).json({ data: null, error: 'Vehicle not found' });
        if (vehicle.ownerId !== req.user.id && req.user.role !== 'admin')
            return res.status(403).json({ data: null, error: 'Not authorized' });
        await prisma_1.prisma.vehicle.delete({ where: { id: req.params.id } });
        return res.json({ data: { deleted: true }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// POST /api/vehicles/:id/photos
exports.vehiclesRouter.post('/:id/photos', auth_1.authenticate, upload.array('photos', 10), async (req, res) => {
    const vehicle = await prisma_1.prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle)
        return res.status(404).json({ data: null, error: 'Vehicle not found' });
    if (vehicle.ownerId !== req.user.id)
        return res.status(403).json({ data: null, error: 'Not authorized' });
    const files = req.files;
    if (!files?.length)
        return res.status(400).json({ data: null, error: 'No files uploaded' });
    try {
        const urls = await Promise.all(files.map((f, i) => (0, storage_1.uploadToStorage)(`vehicles/${req.params.id}/photo-${Date.now()}-${i}`, f)));
        const updated = await prisma_1.prisma.vehicle.update({
            where: { id: req.params.id },
            data: { photos: { push: urls } },
        });
        return res.json({ data: { photos: updated.photos }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/vehicles/:id/availability
exports.vehiclesRouter.put('/:id/availability', auth_1.authenticate, async (req, res) => {
    const vehicle = await prisma_1.prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle)
        return res.status(404).json({ data: null, error: 'Vehicle not found' });
    if (vehicle.ownerId !== req.user.id)
        return res.status(403).json({ data: null, error: 'Not authorized' });
    try {
        const updated = await prisma_1.prisma.vehicle.update({
            where: { id: req.params.id },
            data: { available: req.body.available },
        });
        return res.json({ data: { available: updated.available }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
//# sourceMappingURL=vehicles.js.map