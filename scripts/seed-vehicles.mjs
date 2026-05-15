import https from 'https';

const SUPABASE_URL = 'https://rkwbixidpaqweavghfea.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc2NjE5OCwiZXhwIjoyMDkzMzQyMTk4fQ.YhuyGwW8qia858aqMfu3nhPkmLNoIRgdWpQ6AxSvI9U';

const STORAGE_URL = SUPABASE_URL + '/storage/v1/object/public/omnidrive/vehicles/';

const USERS = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    authId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: 'carlos@demo.ec',
    phone: '+593991234567',
    name: 'Carlos',
    lastName: 'Mendoza',
    documentType: 'cedula',
    documentId: '1712345678',
    role: 'user',
    identityVerified: true,
    driverScore: 750,
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    authId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    email: 'maria@demo.ec',
    phone: '+593992345678',
    name: 'María',
    lastName: 'González',
    documentType: 'cedula',
    documentId: '1723456789',
    role: 'user',
    identityVerified: true,
    driverScore: 820,
  },
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    authId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    email: 'pedro@demo.ec',
    phone: '+593993456789',
    name: 'Pedro',
    lastName: 'Ramírez',
    documentType: 'cedula',
    documentId: '1734567890',
    role: 'user',
    identityVerified: true,
    driverScore: 680,
  },
];

const VEHICLES = [
  {
    id: 'd4e5f6a7-b8c9-0123-defa-123456789012',
    ownerId: USERS[0].id,
    brand: 'Toyota', model: 'Corolla', year: 2023, plate: 'ABC-1234', color: 'Blanco', vin: '1HGBH41JXMN109186',
    category: 'car', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
    pricePerHour: 8, pricePerDay: 40, deposit: 150,
    locationName: 'Quito - Centro', features: ['Aire acondicionado', 'Bluetooth', 'Cámara reversa', 'ABS'],
    mileage: 15000, insurance: true, photos: [`${STORAGE_URL}toyota-corolla.jpg`],
  },
  {
    id: 'e5f6a7b8-c9d0-1234-efab-234567890123',
    ownerId: USERS[1].id,
    brand: 'Chevrolet', model: 'D-MAX', year: 2024, plate: 'DEF-5678', color: 'Gris', vin: '2HGBH41JXMN109187',
    category: 'truck', seats: 5, doors: 4, transmission: 'manual', fuelType: 'diesel',
    pricePerHour: 12, pricePerDay: 60, deposit: 200,
    locationName: 'Quito - Norte', features: ['4x4', 'Dirección hidráulica', 'Radio USB', 'Canopy'],
    mileage: 8000, insurance: true, photos: [`${STORAGE_URL}chevrolet-dmax.jpg`],
  },
  {
    id: 'f6a7b8c9-d0e1-2345-fabc-345678901234',
    ownerId: USERS[0].id,
    brand: 'Yamaha', model: 'MT-07', year: 2023, plate: 'GHI-9012', color: 'Azul', vin: '3HGBH41JXMN109188',
    category: 'motorcycle', seats: 2, doors: 0, transmission: 'manual', fuelType: 'gasoline',
    pricePerHour: 6, pricePerDay: 25, deposit: 100,
    locationName: 'Quito - Centro', features: ['ABS', 'LED', 'Display digital'],
    mileage: 5000, insurance: true, photos: [`${STORAGE_URL}yamaha-mt07.jpg`],
  },
  {
    id: 'a7b8c9d0-e1f2-3456-abcd-456789012345',
    ownerId: USERS[1].id,
    brand: 'BMW', model: 'X5', year: 2024, plate: 'JKL-3456', color: 'Negro', vin: '4HGBH41JXMN109189',
    category: 'suv', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
    pricePerHour: 25, pricePerDay: 150, deposit: 500,
    locationName: 'Quito - Cumbayá', features: ['Asientos cuero', 'Panorámico', 'GPS', 'Sensores', 'Cámara 360'],
    mileage: 3000, insurance: true, photos: [`${STORAGE_URL}bmw-x5.jpg`],
  },
  {
    id: 'b8c9d0e1-f2a3-4567-bcde-567890123456',
    ownerId: USERS[2].id,
    brand: 'Kia', model: 'Sportage', year: 2023, plate: 'MNO-7890', color: 'Rojo', vin: '5HGBH41JXMN109190',
    category: 'suv', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
    pricePerHour: 10, pricePerDay: 50, deposit: 180,
    locationName: 'Guayaquil - Urdesa', features: ['Aire acondicionado', 'Bluetooth', 'Cámara reversa', 'USB'],
    mileage: 22000, insurance: true, photos: [`${STORAGE_URL}kia-sportage.jpg`],
  },
  {
    id: 'c9d0e1f2-a3b4-5678-cdef-678901234567',
    ownerId: USERS[2].id,
    brand: 'Honda', model: 'Civic', year: 2024, plate: 'PQR-1234', color: 'Plata', vin: '6HGBH41JXMN109191',
    category: 'car', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
    pricePerHour: 12, pricePerDay: 55, deposit: 200,
    locationName: 'Guayaquil - Centro', features: ['Turbo', 'Aire acondicionado', 'Bluetooth', 'Cámara', 'ABS'],
    mileage: 5000, insurance: true, photos: [`${STORAGE_URL}honda-civic.jpg`],
  },
  {
    id: 'd0e1f2a3-b4c5-6789-defa-789012345678',
    ownerId: USERS[0].id,
    brand: 'Ford', model: 'Mustang', year: 2023, plate: 'STU-5678', color: 'Amarillo', vin: '7HGBH41JXMN109192',
    category: 'luxury', seats: 4, doors: 2, transmission: 'automatic', fuelType: 'gasoline',
    pricePerHour: 30, pricePerDay: 180, deposit: 600,
    locationName: 'Quito - La Carolina', features: ['Convertible', 'Asientos cuero', 'Premium sound', 'GPS', 'Cámara'],
    mileage: 2000, insurance: true, photos: [`${STORAGE_URL}ford-mustang.jpg`],
  },
  {
    id: 'e1f2a3b4-c5d6-7890-efab-890123456789',
    ownerId: USERS[1].id,
    brand: 'Mazda', model: 'CX-5', year: 2024, plate: 'VWX-9012', color: 'Azul oscuro', vin: '8HGBH41JXMN109193',
    category: 'suv', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
    pricePerHour: 14, pricePerDay: 65, deposit: 250,
    locationName: 'Quito - Valle', features: ['SkyActiv', 'Aire', 'Bluetooth', 'Cámara 360', 'Sensores'],
    mileage: 10000, insurance: true, photos: [`${STORAGE_URL}mazda-cx5.jpg`],
  },
  {
    id: 'f2a3b4c5-d6e7-8901-fabc-901234567890',
    ownerId: USERS[2].id,
    brand: 'Nissan', model: 'Sentra', year: 2023, plate: 'YZA-3456', color: 'Gris', vin: '9HGBH41JXMN109194',
    category: 'car', seats: 5, doors: 4, transmission: 'automatic', fuelType: 'gasoline',
    pricePerHour: 7, pricePerDay: 35, deposit: 120,
    locationName: 'Guayaquil - Samborondón', features: ['Ahorrador', 'Aire', 'Bluetooth', 'Cámara', 'ABS'],
    mileage: 18000, insurance: true, photos: [`${STORAGE_URL}nissan-sentra.jpg`],
  },
];

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'rkwbixidpaqweavghfea.supabase.co',
      path: '/rest/v1/' + path,
      method,
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (resp) => {
      let b = '';
      resp.on('data', c => b += c);
      resp.on('end', () => {
        if (resp.statusCode < 300) resolve(JSON.parse(b || '[]'));
        else reject(new Error(`${resp.statusCode}: ${b.slice(0,200)}`));
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== Seed de usuarios ===\n');
  for (const u of USERS) {
    try {
      // Primero verificar si existe
      const existing = await apiCall('GET', `User?select=id&email=eq.${encodeURIComponent(u.email)}`);
      if (existing.length > 0) {
        console.log(`  Usuario ya existe: ${u.email}`);
        continue;
      }
      await apiCall('POST', 'User', u);
      console.log(`  Creado: ${u.email} (${u.name} ${u.lastName})`);
    } catch (err) {
      console.log(`  Error con ${u.email}: ${err.message}`);
    }
  }

  console.log('\n=== Seed de vehículos ===\n');
  for (const v of VEHICLES) {
    try {
      const existing = await apiCall('GET', `Vehicle?select=id&plate=eq.${encodeURIComponent(v.plate)}`);
      if (existing.length > 0) {
        console.log(`  Vehículo ya existe: ${v.plate} (${v.brand} ${v.model})`);
        continue;
      }
      await apiCall('POST', 'Vehicle', v);
      console.log(`  Creado: ${v.brand} ${v.model} (${v.plate}) - \$${v.pricePerDay}/día`);
    } catch (err) {
      console.log(`  Error con ${v.brand} ${v.model}: ${err.message}`);
    }
  }

  // Verificar resultados
  console.log('\n=== Verificación ===\n');
  const users = await apiCall('GET', 'User?select=id,email,name&limit=10');
  console.log(`  Usuarios totales: ${users.length}`);
  const vehicles = await apiCall('GET', 'Vehicle?select=id,brand,model,plate&limit=20');
  console.log(`  Vehículos totales: ${vehicles.length}`);
  for (const v of vehicles) {
    console.log(`    - ${v.brand} ${v.model} (${v.plate})`);
  }

  console.log('\n✅ Seed completado exitosamente');
}

main().catch(console.error);
