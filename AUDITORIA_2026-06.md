# Auditoría OmniDrive — Junio 2026

> Basada en lectura directa del código en `C:\Users\Admin\Desktop\omnidrive-new` (rama `master`, commit `7e728d6`). Marketplace P2P de alquiler de vehículos. MVP gratuito (sin cobros reales todavía).

Prioridades: 🔴 crítica · 🟡 importante · 🟢 nice-to-have.

---

## 0. Resumen ejecutivo

El proyecto está bien estructurado y la mayoría de rutas verifican propiedad correctamente. **Pero hay 4 fallos críticos que deben corregirse antes de cualquier lanzamiento**, incluso gratuito, porque permiten tomar control de la cuenta admin y manipular datos:

| # | Hallazgo | Severidad |
|---|----------|-----------|
| 1 | Endpoint `GET /api/seed` **público** que recrea el admin con contraseña conocida | 🔴 |
| 2 | `JWT_SECRET` con fallback hardcodeado en el repo | 🔴 |
| 3 | Sin rate-limiting en ningún login (admin ni Supabase) | 🔴 |
| 4 | `POST /api/reviews` sin validar autoría → cualquiera infla/destruye ratings | 🔴 |
| 5 | `PUT /api/vehicles/:id` con mass-assignment (`...req.body`) | 🔴 |
| 6 | Reserva permitida a usuarios **no verificados** | 🟡 |
| 7 | `wallet` puede quedar negativo; pagos "fake" | 🟡 |
| 8 | Sin índices en la BD; sin tests; `db push --accept-data-loss` en build | 🟡/🟢 |

---

## 1. Seguridad 🔴

### 1.1 🔴 CRÍTICO — Endpoint de seed público (backdoor de admin)
`backend/src/routes/seed.ts` + `backend/src/index.ts:63`

```ts
seedRouter.get('/', asyncHandler(async (_req, res) => { await prisma(); ... }));
app.use('/api/seed', seedRouter);   // SIN authenticate, SIN adminAuth
```

El seed (`backend/prisma/seed.ts:36`) **borra y recrea** el usuario admin:
```ts
const adminAuthId = await createAuthUser('admin@omnidrive.ec', 'Admin1234!', '+593900000000');
```
Cualquiera que haga `GET https://omnidrive.lat/api/seed` puede:
- Resetear la BD a datos semilla.
- Recrear `admin@omnidrive.ec` con contraseña **conocida y pública** (`Admin1234!`) → login admin completo.

**Acción inmediata:** eliminar el router de producción (o protegerlo con `adminAuth + requireSuperAdmin` y deshabilitarlo por `NODE_ENV`). Rotar la contraseña del admin real. Es lo primero que arreglaría hoy.

### 1.2 🔴 JWT_SECRET con fallback inseguro
`backend/src/routes/admin.ts:9`
```ts
const JWT_SECRET = process.env.JWT_SECRET || 'omnidrive_admin_jwt_2026';
```
Si la env var no está seteada en Railway, **el secreto es público** (está en el repo en GitHub). Un atacante puede firmar su propio token `{ role: 'superadmin' }` y entrar como superadmin.

**Acción:** quitar el fallback; fallar el arranque si `JWT_SECRET` no existe:
```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET requerido');
```
Verificar que la env var esté en Railway con un valor aleatorio de 64+ chars. Rotarla (invalida sesiones admin actuales — aceptable).

### 1.3 🔴 Sin rate-limiting
No existe `express-rate-limit` (revisado `package.json`). Ni `/api/admin/auth/login` ni el login Supabase del frontend tienen throttle → fuerza bruta libre sobre `Admin1234!` y sobre cuentas de usuarios.

**Acción:** añadir `express-rate-limit` global y un limitador estricto en login (p. ej. 5 intentos / 15 min / IP). Considerar `app.set('trust proxy', 1)` porque Railway está detrás de proxy.

### 1.4 🔴 Reviews sin validación de autoría (IDOR + manipulación de rating)
`backend/src/routes/reviews.ts:9`
```ts
const { bookingId, targetId, vehicleId, rating, comment } = req.body;
// NO verifica que el booking exista, esté 'completed', ni que req.user sea parte de él.
// targetId y vehicleId vienen del cliente sin validar.
await prisma.review.create({ data: { bookingId, authorId: req.user!.id, targetId, vehicleId, rating, ... }});
```
Cualquier usuario autenticado puede:
- Calificar reservas que no son suyas.
- Subir/bajar el `rating` de **cualquier** usuario o vehículo (lo recalcula sobre `targetId`/`vehicleId` arbitrarios).
- Solo lo frena el `@unique` en `bookingId` (una reseña por reserva), pero el atacante elige el `bookingId`.

**Acción:** cargar el booking, exigir `status === 'completed'`, que `req.user.id` sea tenant u owner, y **derivar** `targetId`/`vehicleId` del booking en el servidor — nunca del body.

### 1.5 🔴 Mass-assignment en update de vehículo
`backend/src/routes/vehicles.ts:167`
```ts
const data = { ...req.body };          // ← todo el body entra a Prisma
const updated = await prisma.vehicle.update({ where: { id }, data });
```
El dueño (o admin) puede setear campos que no debería: `ownerId` (transferir/robar el vehículo a otra cuenta), `rating`, `totalRentals`, `insurance: true` (fingir seguro), `vin`, `plate`, etc.

**Acción:** lista blanca explícita de campos editables (igual que hace `PUT /api/auth/me`).

### 1.6 🟡 Login admin: chequeo de rol débil
`admin.ts:19` — `if (!admin || admin.role === 'user')`. Funciona, pero acopla la seguridad a que el `username` no exista para usuarios normales. Mejor: `if (!['admin','superadmin','verifier'].includes(admin.role))`.

### 1.7 🟡 CORS con `origin:'*'` + `credentials:true`
`index.ts:44` — si `FRONTEND_URL` no está seteada, queda `origin:'*'` con `credentials:true` (combinación inválida/insegura). Fijar el origin a `https://omnidrive.lat` explícitamente.

### 1.8 🟢 Otros
- **CSP / Helmet:** correctos y actualizados (Helmet 8, `scriptSrc 'self'`, Cloudinary/Supabase en allowlist). Bien.
- **WebServices.ec:** la API key se lee de env (`webservices-ec.ts:14`), va en header `Authorization: Bearer`. Correcto, no hardcodeada. Verificar que no esté en `.env` commiteado.
- **Supabase:** backend usa **service_role key** (bypassa RLS) — correcto para servidor. El anon key en frontend es normal. Como la BD de la app es Railway/Prisma (no Supabase), el riesgo de RLS es bajo **siempre que el proyecto Supabase no tenga tablas de negocio**. Confirmar que Supabase se usa solo para Auth.
- `verify-identity` (`auth.ts:64`) solo sube documentos y deja `Pending manual review` — bien. Pero el flujo `verificar-cedula` en modo **offline** (sin provider) marca `identityVerified:true` solo con el dígito verificador de la cédula (`auth.ts:187`). Eso es "verificación" falsa. Aceptable en MVP, **no** en producción con dinero.

---

## 2. Backups y datos 🔴/🟡

- **Backup semanal a Cloudinary:** no pude verificar el script de restore desde el código del repo (el cron vive en infra). **Nunca asumas que un backup sirve hasta restaurarlo.** Acción: hacer **un restore de prueba** a una BD desechable y documentar el procedimiento. Sin esto, el backup es teórico.
- **Índices:** el `schema.prisma` **no tiene un solo `@@index`**. Los queries calientes escanean tabla:
  - `Booking` por `vehicleId + status` (conflictos de fechas, en cada búsqueda y reserva).
  - `Booking` por `tenantId`, `Vehicle` por `ownerId`, `Review` por `targetId`/`vehicleId`, `Notification` por `userId`.
  - Acción: añadir índices. Con 3 vehículos no se nota; con tráfico real, sí.
- **Logs de actividad:** solo `morgan` (HTTP) y `console.error`. No hay tabla de auditoría (quién verificó/baneó/cambió rol). Para un marketplace con dinero, conviene un `AuditLog` (acciones admin sobre usuarios/bookings).

---

## 3. Lógica de negocio 🟡

### Flujo de reserva (revisado en `bookings.ts`)
`pending → confirmed (owner) → active (owner inicia) → completed (owner finaliza)`. El flujo está **bien modelado** y cada transición valida propiedad y estado. Observaciones:

1. 🟡 **Reservar sin estar verificado:** `POST /api/bookings` solo usa `authenticate`, **no** `requireVerified`. Un usuario sin identidad verificada puede reservar. Crear vehículo sí exige `requireVerified` (`vehicles.ts:112`). Inconsistente para un marketplace.
2. 🟡 **Pago "fake" y wallet negativo:** en `master` el pago se simula al finalizar (`/end`, `bookings.ts:289`) decrementando `walletBalance` del tenant **sin comprobar saldo** → puede quedar negativo. No hay cobro real (esperado en MVP gratuito), pero el modelo de "pago al finalizar" es riesgoso: el dueño entrega el auto sin garantía de fondos.
3. 🟡 **Seguro:** es solo un `Boolean insurance` en `Vehicle` + `insuranceExpires` que **nunca se valida**. Las reservas fuerzan `hasInsurance:false` y `liabilityWaiver:true` con un disclaimer P2P (`bookings.ts:115`). No hay validación real de póliza activa. Para producción con dinero esto es responsabilidad legal seria.
4. 🟡 **Cancelaciones:** `PUT /:id/cancel` no aplica política ni penalización; reembolsa depósito completo si estaba `held`. Falta política (ventana de cancelación, quién asume el costo).
5. 🟢 **Disputas:** `POST /:id/dispute` marca `disputed` y notifica admins. Correcto como esqueleto, pero no hay resolución (reembolso/cobro) implementada.
6. **Atomicidad:** en `/end`, los `totalTrips` y `totalRentals` se actualizan **fuera** del `$transaction` (líneas 333-346). Si fallan, quedan inconsistentes. Meterlos dentro de la transacción.

### Stripe Connect (rama `feature/stripe-connect`)
- La rama está **14 commits adelante de master, 0 detrás** → al día. **Pero `feature/messaging` tiene el diff idéntico** a stripe-connect: ambas ramas son básicamente lo mismo (incluyen pagos *y* mensajería juntos). Ojo al mergear.
- Lo implementado: `services/wallet.ts` (hold/release/refund sobre wallet interno), `routes/payments.ts`, `services/stripe.ts`, `routes/stripe.ts`, `routes/subscriptions.ts`, páginas `Wallet.tsx` y `Messages.tsx`.
- ⚠️ **El "depósito" no cobra de verdad:** `POST /api/payments/deposit` (`payments.ts`) hace `walletBalance: { increment: amount }` sin pasar por Stripe. Es dinero ficticio. Falta: webhook de Stripe que confirme el `PaymentIntent` antes de acreditar, y Stripe Connect (cuentas conectadas de dueños) para los payouts. La base está; **falta toda la integración real de cobro/payout y verificación de webhooks.**

---

## 4. Frontend y UX 🟡

- 🟡 **Sin code-splitting:** `App.tsx` importa todas las páginas de forma estática (no hay `lazy`/`Suspense`), y `vite.config.ts` no define `manualChunks`. Con `mapbox-gl` + `@supabase/supabase-js` + `date-fns` en el bundle, el JS inicial es pesado. Acción: `React.lazy` por ruta y separar `mapbox` en su propio chunk.
- 🟢 **`sourcemap: true` en build de producción** (`vite.config.ts:17`) → expone el código fuente original. Quitar en prod.
- ✅ **Hash router** custom (`App.tsx`) funciona y maneja bien el callback OAuth de Google (`#access_token`). Correcto para SPA sin server-side routing.
- ✅ **AdminRoute** (`App.tsx:129`) protege `/admin` en el cliente; la protección real es server-side (JWT propio), así que el bypass de UI no da acceso a datos. Bien.
- El panel admin (`pages/Admin.tsx`) está **cableado a endpoints reales** (no es esqueleto): dashboard, usuarios, vehículos, bookings, baneos, verificación.

---

## 5. Deuda técnica 🟢

- **Sin tests** (no hay `vitest`/`jest` en ninguno de los `package.json`). Para flujos de dinero, al menos tests de `calcBase`/`calcDuration` y de transiciones de booking.
- **`build` peligroso:** `backend/package.json:10` → `prisma db push --accept-data-loss` en cada deploy. **No usa migraciones.** Un cambio de schema puede borrar columnas/datos en producción sin aviso. Acción: migrar a `prisma migrate deploy` con migraciones versionadas.
- **Ramas:** `feature/stripe-connect` y `feature/messaging` duplicadas (mismo diff). Consolidar antes de mergear. Existe rama `debug-pages` huérfana.
- Archivos sueltos en raíz (`PROMPT_GEMINI_UI.txt`, `generado gemini.txt`, `test.html`, `test-auth.mjs`, `tmp-photos/`) — limpiar.
- `calcBase` (`bookings.ts:18`) tiene lógica de redondeo confusa (`days >= 0.84`, `Math.ceil(hours)/24`) — candidata a bug de precio; cubrir con tests.

---

## 6. Política multi-vehículo / "Empresa Verificada"

Buenas noticias: el modelo **ya soporta casi todo** sin romper nada.

- `User.subscriptionTier` (free/premium/elite) y el modelo `Subscription` ya existen.
- `Vehicle.ownerId` ya permite N vehículos por dueño (hoy sin límite).

Cambios necesarios (aditivos, no rompen el flujo):
1. **Límite de 1 vehículo para `free`:** en `POST /api/vehicles`, contar vehículos del owner y rechazar el 2.º si `subscriptionTier === 'free'`. (Hoy **no hay límite** — cualquiera publica los que quiera.)
2. **Insignia "Empresa Verificada":** añadir `User.isBusiness Boolean @default(false)` + `businessVerifiedAt`. La insignia se pinta en `VehicleCard`/perfil leyendo ese flag. Activación manual por admin (endpoint nuevo `PUT /api/admin/users/:id/business`). Cero impacto en el flujo de reserva.
3. **Roles/permisos:** no necesitas un rol nuevo. `isBusiness` + `subscriptionTier` cubren el caso. Reportería/CRM = nuevas vistas admin filtrando por `ownerId`.
4. **Monetización futura:** el modelo `Transaction` ya tiene `type: 'subscription'` y `type: 'commission'`. Listo para enchufar cuando llegue Stripe.

Migración: 2 columnas nuevas + un índice. Trivial.

---

## 7. Recomendaciones priorizadas

**Antes de lanzar (incluso gratis) — esta semana:**
1. Eliminar/blindar `GET /api/seed` y rotar la contraseña del admin. 🔴
2. Quitar fallback de `JWT_SECRET` y verificar la env en Railway. 🔴
3. `express-rate-limit` en logins. 🔴
4. Arreglar `POST /api/reviews` (validar autoría + booking completed). 🔴
5. Lista blanca en `PUT /api/vehicles/:id`. 🔴
6. `requireVerified` en creación de reservas. 🟡
7. Probar un restore real del backup. 🔴

**Para pasar a producción con pagos reales:**
- Completar Stripe Connect: webhooks firmados, `PaymentIntent` real antes de acreditar wallet, cuentas conectadas de dueños para payouts, manejo de `held → released → refunded` atómico.
- Migrar `db push` → `prisma migrate deploy`.
- Validación real de seguro (póliza activa) o disclaimer legal firme + términos.
- Política de cancelación con penalizaciones.
- Facturación electrónica SRI: integrar con un PAC ecuatoriano (ej. Datil, Contífico) que emita comprobantes autorizados; generar factura al completar `/end`. El `Transaction` ya guarda lo necesario.
- Seguros: convenio con aseguradora EC (ej. Chubb, Equinoccial) para póliza por viaje; guardar nº de póliza en `Booking.insuranceDetails`.
- Índices, tests, tabla `AuditLog`.

---

## 8. Mi recomendación sobre la política multi-vehículo

**Planifica el modelo ahora, pero NO la incluyas como feature en esta tanda. Secuencia: (1) fixes de seguridad 🔴 → (2) cerrar MVP → (3) multi-vehículo/Empresa → (4) Stripe real.**

Argumentos:
- **Los fixes de seguridad son no negociables y urgentes.** El endpoint `/api/seed` y el `JWT_SECRET` son tomas de control de admin que existen *ahora mismo* en producción. Eso va primero, solo. Mezclarlo con features nuevas retrasa el parche.
- **La política multi-vehículo es barata y aditiva** (2 columnas + un check de límite + una insignia). No bloquea ni se beneficia de hacerse "ya": no toca el flujo de reserva ni los pagos. Hacerla después no genera retrabajo.
- **Pero el *diseño de datos* sí conviene fijarlo ahora** para no migrar dos veces: agrega `isBusiness`/`businessVerifiedAt` en la **misma** próxima migración en la que metas índices y `AuditLog`. Así el schema queda listo aunque la UI/lógica llegue luego.
- **El riesgo real está en Stripe**, no en la política de cuentas. Gastar foco en "Empresa Verificada" antes de tener cobros reales y seguros es optimizar la monetización de algo que aún no factura. Primero que la plataforma sea **segura y cobre bien**, luego segmenta clientes empresa.

En una frase: **arregla la seguridad esta semana, lanza el MVP, deja las 2 columnas listas en la migración, y construye multi-vehículo + Stripe como el siguiente bloque — en ese orden.**
