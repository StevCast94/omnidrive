"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const supabase_js_1 = require("@supabase/supabase-js");
const prisma = new client_1.PrismaClient();
// Admin client to create Supabase Auth users
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
/** Create a Supabase Auth user and return the auth UUID */
async function createAuthUser(email, password, phone) {
    // Delete if already exists (idempotent seed)
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users?.find(u => u.email === email);
    if (found) {
        await supabase.auth.admin.deleteUser(found.id);
    }
    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        phone,
        email_confirm: true,
    });
    if (error || !data.user)
        throw new Error(`Auth user creation failed for ${email}: ${error?.message}`);
    return data.user.id; // Supabase UUID
}
async function main() {
    console.log('🌱 Seeding OmniDrive...');
    // ── Admin ────────────────────────────────────────────────
    const adminAuthId = await createAuthUser('admin@omnidrive.ec', 'Admin1234!', '+593900000000');
    const admin = await prisma.user.upsert({
        where: { email: 'admin@omnidrive.ec' },
        update: { authId: adminAuthId },
        create: {
            authId: adminAuthId,
            email: 'admin@omnidrive.ec',
            phone: '+593900000000',
            name: 'Admin',
            lastName: 'OmniDrive',
            documentType: 'cedula',
            documentId: '0000000000',
            identityVerified: true,
            verifiedAt: new Date(),
            role: 'admin',
            walletBalance: 0,
            rating: 1000,
        },
    });
    console.log('  ✓ Admin:', admin.email);
    // ── Owner demo ───────────────────────────────────────────
    const ownerAuthId = await createAuthUser('carlos@demo.ec', 'Owner1234!', '+593991111111');
    const owner = await prisma.user.upsert({
        where: { email: 'carlos@demo.ec' },
        update: { authId: ownerAuthId },
        create: {
            authId: ownerAuthId,
            email: 'carlos@demo.ec',
            phone: '+593991111111',
            name: 'Carlos',
            lastName: 'Mendoza',
            documentType: 'cedula',
            documentId: '1712345678',
            identityVerified: true,
            verifiedAt: new Date(),
            walletBalance: 250.00,
            rating: 820,
            totalTrips: 14,
        },
    });
    console.log('  ✓ Owner demo:', owner.email);
    // ── Tenant demo ──────────────────────────────────────────
    const tenantAuthId = await createAuthUser('sofia@demo.ec', 'Tenant1234!', '+593992222222');
    const tenant = await prisma.user.upsert({
        where: { email: 'sofia@demo.ec' },
        update: { authId: tenantAuthId },
        create: {
            authId: tenantAuthId,
            email: 'sofia@demo.ec',
            phone: '+593992222222',
            name: 'Sofía',
            lastName: 'Paredes',
            documentType: 'cedula',
            documentId: '1798765432',
            identityVerified: true,
            verifiedAt: new Date(),
            walletBalance: 500.00,
            subscriptionTier: 'premium',
            rating: 760,
            totalTrips: 6,
        },
    });
    console.log('  ✓ Tenant demo:', tenant.email);
    // ── Vehicles ─────────────────────────────────────────────
    const vehicleData = [
        {
            brand: 'Toyota', model: 'Corolla', year: 2023, plate: 'PBG-1234',
            color: 'Blanco perla', vin: 'JTDBU4EE1A9012345',
            category: 'car', seats: 5, transmission: 'automatic', fuelType: 'gasoline',
            pricePerHour: 8.00, pricePerDay: 55.00, deposit: 100.00,
            locationLat: -0.1807, locationLng: -78.4678, locationName: 'La Carolina, Quito Norte',
            insurance: true, features: ['ac', 'bluetooth', 'usb', 'backup_camera'],
            photos: [
                'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800',
                'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800',
            ],
            rating: 4.8, totalRentals: 23,
        },
        {
            brand: 'Chevrolet', model: 'D-MAX', year: 2022, plate: 'PCA-5678',
            color: 'Gris oscuro', vin: 'JACDPA12A7A067890',
            category: 'truck', seats: 5, transmission: 'manual', fuelType: 'diesel',
            pricePerHour: 12.00, pricePerDay: 80.00, deposit: 200.00,
            locationLat: -0.2295, locationLng: -78.5243, locationName: 'Valle de los Chillos',
            insurance: true, features: ['ac', 'bluetooth'],
            photos: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'],
            rating: 4.6, totalRentals: 11,
        },
        {
            brand: 'Yamaha', model: 'MT-07', year: 2023, plate: 'MBG-9012',
            color: 'Negro mate', vin: 'JYARJ18E09A012345',
            category: 'motorcycle', seats: 2, transmission: 'manual', fuelType: 'gasoline',
            pricePerHour: 5.00, pricePerDay: 35.00, deposit: 150.00,
            locationLat: -0.1547, locationLng: -78.4710, locationName: 'Iñaquito, Quito',
            insurance: false, features: ['bluetooth'],
            photos: ['https://images.unsplash.com/photo-1558980394-4c7c9299fe96?w=800'],
            rating: 4.9, totalRentals: 31,
        },
        {
            brand: 'BMW', model: 'X5', year: 2022, plate: 'PBH-3456',
            color: 'Negro carbón', vin: '5UXKR0C50JL012345',
            category: 'luxury', seats: 5, transmission: 'automatic', fuelType: 'gasoline',
            pricePerHour: 25.00, pricePerDay: 180.00, deposit: 500.00,
            locationLat: -0.1900, locationLng: -78.4850, locationName: 'González Suárez, Quito',
            withDriver: true, driverPrice: 40.00,
            insurance: true, features: ['ac', 'gps', 'bluetooth', 'usb', 'leather', 'sunroof'],
            photos: ['https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800'],
            rating: 5.0, totalRentals: 8,
        },
        {
            brand: 'Kia', model: 'Sportage', year: 2023, plate: 'PCC-7890',
            color: 'Rojo pasión', vin: 'KNDPM3AC8J7012345',
            category: 'suv', seats: 5, transmission: 'automatic', fuelType: 'gasoline',
            pricePerHour: 10.00, pricePerDay: 65.00, deposit: 120.00,
            locationLat: -0.2100, locationLng: -78.5100, locationName: 'Cumbayá, Quito',
            insurance: true, features: ['ac', 'gps', 'bluetooth', 'backup_camera'],
            photos: ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800'],
            rating: 4.7, totalRentals: 19,
        },
        {
            brand: 'Hyundai', model: 'H1', year: 2021, plate: 'PBC-2345',
            color: 'Plata', vin: 'KMHWG81JXAU012345',
            category: 'van', seats: 12, transmission: 'automatic', fuelType: 'diesel',
            pricePerHour: 15.00, pricePerDay: 95.00, deposit: 250.00,
            locationLat: -0.2400, locationLng: -78.5200, locationName: 'Sangolquí, Rumiñahui',
            withDriver: true, driverPrice: 35.00,
            insurance: true, features: ['ac', 'bluetooth', 'usb'],
            photos: ['https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800'],
            rating: 4.5, totalRentals: 27,
        },
    ];
    for (const v of vehicleData) {
        const { features, photos, rating, totalRentals, withDriver, driverPrice, insurance, ...base } = v;
        await prisma.vehicle.upsert({
            where: { plate: v.plate },
            update: {},
            create: {
                ...base,
                ownerId: owner.id,
                features: features ?? [],
                photos: photos ?? [],
                rating: rating ?? 0,
                totalRentals: totalRentals ?? 0,
                withDriver: withDriver ?? false,
                driverPrice: driverPrice ?? undefined,
                insurance: insurance ?? false,
            },
        });
        console.log(`  ✓ Vehicle: ${v.brand} ${v.model} (${v.plate})`);
    }
    // ── Demo subscription for tenant ─────────────────────────
    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setMonth(endsAt.getMonth() + 1);
    await prisma.subscription.upsert({
        where: { userId: tenant.id },
        update: {},
        create: {
            userId: tenant.id,
            tier: 'premium',
            price: 9.99,
            interval: 'monthly',
            startsAt: now,
            endsAt,
            status: 'active',
            benefits: [
                'Pagos P2P con wallet interna',
                'Sin comisión en primeras 3 reservas/mes',
                'Soporte prioritario',
                'Tracking GPS incluido',
                'Insignia Premium en perfil',
            ],
        },
    });
    console.log('  ✓ Subscription: Premium para Sofía');
    // ── Welcome notifications ─────────────────────────────────
    await prisma.notification.createMany({
        data: [
            {
                userId: owner.id,
                type: 'welcome',
                title: '🎉 Bienvenido a OmniDrive',
                body: 'Tus vehículos ya están publicados. ¡Empieza a recibir reservas!',
            },
            {
                userId: tenant.id,
                type: 'welcome',
                title: '🎉 Bienvenida a OmniDrive',
                body: 'Tu cuenta Premium está activa. Explora los vehículos disponibles.',
            },
        ],
        skipDuplicates: true,
    });
    console.log('\n🎉 Seed completo!');
    console.log('─────────────────────────────────');
    console.log('  Admin:   admin@omnidrive.ec  / Admin1234!');
    console.log('  Owner:   carlos@demo.ec      / Owner1234!');
    console.log('  Tenant:  sofia@demo.ec       / Tenant1234!');
    console.log('─────────────────────────────────');
}
main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map