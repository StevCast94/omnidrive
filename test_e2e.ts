/**
 * OmniDrive — E2E Flow Tests
 * Prueba el flujo completo: registro → vehículo → reserva → pago → review
 * Ejecutar: npx tsx src/tests/e2e.test.ts
 */

const API = process.env.API_URL ?? 'http://localhost:3000/api';

let ownerToken = '';
let tenantToken = '';
let vehicleId = '';
let bookingId = '';

type R = { data: any; error: string | null };

async function req(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<R> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`❌ FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function run() {
  console.log('\n🧪 OmniDrive E2E Tests');
  console.log('='.repeat(40));

  // ── 1. Health check ──────────────────────────────────────
  console.log('\n[1] Health check');
  const health = await fetch(`${API.replace('/api', '')}/health`).then(r => r.json());
  assert(health.status === 'ok', 'API está en línea');

  // ── 2. Registro owner ────────────────────────────────────
  console.log('\n[2] Registro de owner');
  const ts = Date.now();
  const ownerRes = await req('POST', '/auth/register', {
    email: `owner_${ts}@test.ec`,
    phone: `+5939${ts.toString().slice(-8)}`,
    password: 'Test1234!',
    name: 'Carlos', lastName: 'Test',
    documentType: 'cedula', documentId: `${ts.toString().slice(-10)}`,
  });
  assert(!ownerRes.error, 'Owner registrado');
  assert(!!ownerRes.data?.token, 'Token recibido');
  ownerToken = ownerRes.data.token;

  // ── 3. Registro tenant ───────────────────────────────────
  console.log('\n[3] Registro de tenant');
  const tenantRes = await req('POST', '/auth/register', {
    email: `tenant_${ts}@test.ec`,
    phone: `+5938${ts.toString().slice(-8)}`,
    password: 'Test1234!',
    name: 'Sofía', lastName: 'Test',
    documentType: 'cedula', documentId: `1${ts.toString().slice(-9)}`,
  });
  assert(!tenantRes.error, 'Tenant registrado');
  tenantToken = tenantRes.data.token;

  // ── 4. Verificar identidad (admin) ───────────────────────
  console.log('\n[4] Login admin + verificar identidades');
  const adminRes = await req('POST', '/auth/login', {
    email: 'admin@omnidrive.ec', password: 'Admin1234!',
  });
  assert(!adminRes.error, 'Admin login OK');
  const adminToken = adminRes.data?.token;

  const ownerProfile = await req('GET', '/auth/me', undefined, ownerToken);
  const verifyOwner = await req('PUT', `/admin/users/${ownerProfile.data.id}/verify`, undefined, adminToken);
  assert(verifyOwner.data?.identityVerified === true, 'Owner verificado por admin');

  // ── 5. Crear vehículo ────────────────────────────────────
  console.log('\n[5] Crear vehículo');
  const vRes = await req('POST', '/vehicles', {
    brand: 'Toyota', model: 'Test', year: 2023,
    plate: `TST-${ts.toString().slice(-4)}`,
    color: 'Blanco', vin: `VIN${ts}`,
    category: 'car', seats: 5,
    transmission: 'automatic', fuelType: 'gasoline',
    pricePerHour: 8, pricePerDay: 50,
    deposit: 100, locationName: 'Quito Norte',
    locationLat: -0.18, locationLng: -78.47,
    features: ['ac', 'bluetooth'],
  }, ownerToken);
  assert(!vRes.error, 'Vehículo creado');
  assert(!!vRes.data?.id, 'ID de vehículo recibido');
  vehicleId = vRes.data.id;

  // ── 6. Listar vehículos ──────────────────────────────────
  console.log('\n[6] Listar vehículos');
  const listRes = await req('GET', '/vehicles');
  assert(Array.isArray(listRes.data), 'Lista recibida');
  assert(listRes.data.length >= 1, 'Al menos un vehículo disponible');

  // ── 7. Filtro por fechas (disponibilidad) ────────────────
  console.log('\n[7] Filtro por disponibilidad');
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const filteredRes = await req('GET', `/vehicles?startAt=${start}&endAt=${end}`);
  assert(!filteredRes.error, 'Filtro por fechas OK');

  // ── 8. Detalle de vehículo ───────────────────────────────
  console.log('\n[8] Detalle de vehículo');
  const detailRes = await req('GET', `/vehicles/${vehicleId}`);
  assert(!detailRes.error, 'Detalle OK');
  assert(detailRes.data?.id === vehicleId, 'ID correcto');
  assert(Array.isArray(detailRes.data?.occupiedDates), 'occupiedDates incluido');

  // ── 9. Crear reserva ─────────────────────────────────────
  console.log('\n[9] Crear reserva');
  const bookRes = await req('POST', '/bookings', {
    vehicleId,
    startAt: start,
    endAt: end,
    withDriver: false,
    hasInsurance: false,
    liabilityWaiver: true,
  }, tenantToken);
  assert(!bookRes.error, `Reserva creada (${bookRes.error ?? 'OK'})`);
  assert(bookRes.data?.status === 'pending', 'Estado: pending');
  assert(bookRes.data?.totalAmount > 0, 'totalAmount calculado');
  assert(bookRes.data?.serviceFee > 0, 'serviceFee (15%) calculado');
  bookingId = bookRes.data.id;

  // ── 10. Confirm booking (owner) ──────────────────────────
  console.log('\n[10] Confirmar reserva (owner)');
  const confirmRes = await req('PUT', `/bookings/${bookingId}/confirm`, {
    ownerAcceptsWaiver: true,
  }, ownerToken);
  assert(!confirmRes.error, 'Reserva confirmada');
  assert(confirmRes.data?.status === 'confirmed', 'Estado: confirmed');

  // ── 11. Iniciar reserva ──────────────────────────────────
  console.log('\n[11] Iniciar viaje');
  const startRes = await req('PUT', `/bookings/${bookingId}/start`, {}, ownerToken);
  assert(!startRes.error, 'Viaje iniciado');
  assert(startRes.data?.status === 'active', 'Estado: active');
  assert(startRes.data?.trackingEnabled === true, 'Tracking habilitado');

  // ── 12. Tracking GPS ─────────────────────────────────────
  console.log('\n[12] Tracking GPS');
  const trackRes = await req('POST', `/tracking/${bookingId}`, {
    lat: -0.1807, lng: -78.4678, timestamp: new Date().toISOString(),
  }, tenantToken);
  assert(!trackRes.error, 'Punto GPS registrado');
  assert(trackRes.data?.pointsCount >= 1, 'Punto guardado en memoria');

  const trackGetRes = await req('GET', `/tracking/${bookingId}`, undefined, ownerToken);
  assert(!trackGetRes.error, 'Owner puede ver ruta');
  assert(Array.isArray(trackGetRes.data?.points), 'Puntos devueltos');

  // ── 13. Finalizar viaje ──────────────────────────────────
  console.log('\n[13] Finalizar viaje (owner)');
  const endRes = await req('PUT', `/bookings/${bookingId}/end`, {}, ownerToken);
  assert(!endRes.error, `Viaje finalizado (${endRes.error ?? 'OK'})`);
  assert(endRes.data?.status === 'completed', 'Estado: completed');
  assert(endRes.data?.trackingEnabled === false, 'Tracking deshabilitado');

  // ── 14. Review ───────────────────────────────────────────
  console.log('\n[14] Dejar reseña');
  const ownerMe = await req('GET', '/auth/me', undefined, ownerToken);
  const reviewRes = await req('POST', '/reviews', {
    bookingId,
    targetId: ownerMe.data.id,
    rating: 5,
    comment: 'Excelente propietario, muy atento',
  }, tenantToken);
  assert(!reviewRes.error, `Reseña creada (${reviewRes.error ?? 'OK'})`);
  assert(reviewRes.data?.rating === 5, 'Rating 5 guardado');

  // ── 15. Reviews del owner ────────────────────────────────
  console.log('\n[15] Ver reviews del owner');
  const reviewsRes = await req('GET', `/reviews/${ownerMe.data.id}`);
  assert(!reviewsRes.error, 'Reviews recibidas');
  assert(reviewsRes.data?.total >= 1, 'Al menos una review');

  // ── 16. Wallet ───────────────────────────────────────────
  console.log('\n[16] Wallet');
  const walletRes = await req('GET', '/payments/wallet', undefined, tenantToken);
  assert(!walletRes.error, 'Wallet accesible');
  assert(typeof walletRes.data?.balance !== 'undefined', 'Balance presente');

  // ── 17. Notificaciones ───────────────────────────────────
  console.log('\n[17] Notificaciones');
  const notifRes = await req('GET', '/notifications', undefined, tenantToken);
  assert(!notifRes.error, 'Notificaciones accesibles');
  assert(Array.isArray(notifRes.data), 'Array de notificaciones');

  // ── 18. Admin métricas ───────────────────────────────────
  console.log('\n[18] Métricas admin');
  const metricsRes = await req('GET', '/admin/metrics', undefined, adminToken);
  assert(!metricsRes.error, 'Métricas accesibles');
  assert(metricsRes.data?.totalUsers >= 3, 'Al menos 3 usuarios');
  assert(metricsRes.data?.totalVehicles >= 1, 'Al menos 1 vehículo');

  // ── Resumen ──────────────────────────────────────────────
  console.log('\n' + '='.repeat(40));
  console.log('✅ TODOS LOS TESTS PASARON');
  console.log('='.repeat(40));
  console.log(`\nFlujo probado:`);
  console.log(`  Owner    → ${ownerToken.slice(0, 20)}...`);
  console.log(`  Tenant   → ${tenantToken.slice(0, 20)}...`);
  console.log(`  Vehículo → ${vehicleId}`);
  console.log(`  Reserva  → ${bookingId}`);
  console.log(`  Estados  → pending → confirmed → active → completed`);
  console.log(`  Tracking → GPS reportado y leído por owner`);
  console.log(`  Review   → 5★ enviada`);
  console.log(`  Admin    → métricas OK\n`);
}

run().catch(e => {
  console.error('\n❌ Test fallido:', e.message);
  process.exit(1);
});
