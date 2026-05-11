Eres un desarrollador full-stack senior. Tu tarea es construir el MVP completo de **OmniDrive**, una plataforma P2P de renta de vehículos con/sin chofer para Ecuador. Tienes exactamente 7 días.

## Stack

- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL
- **Frontend Web**: React 19 + Vite 6 + Tailwind 4 + TypeScript
- **Mobile**: React Native (Expo) — opcional para MVP, priorizar web
- **Auth**: Supabase Auth (email + phone)
- **Pagos**: Stripe Connect + Wallet interna
- **Mapas**: Mapbox
- **Push**: Web Push (service worker)
- **Deploy**: Railway (backend) + Netlify (web)

## Instrucciones Específicas

1. **NO hagas preguntas** — todo lo que necesitas está en este prompt y en el blueprint incluido. Si algo no está especificado, usa tu mejor criterio.
2. **Crea un repo de GitHub** público o privado, y haz commits atómicos por feature.
3. **Backend**: Usa la estructura descrita en el blueprint. Todos los endpoints devuelven `{ data, error }`.
4. **Frontend Web**: Responsive (mobile-first). PWA instalable con service worker para push notifications.
5. **Cada día, deploy automático** a Railway + Netlify funcional.
6. **Prueba el flujo completo** antes del día 7.

## Blueprint Completo

Lee y sigue EXACTAMENTE este blueprint a continuación. Cada sección es una especificación vinculante.

=== INICIO DEL BLUEPRINT ===

[MODELO DE DATOS]
Todas las tablas Prisma necesarias están definidas en el siguiente esquema. Úsalas EXACTAMENTE como están:

USER MODEL:
- id (uuid, PK)
- email (unique)
- phone (unique)
- name, lastName
- documentType (cedula, pasaporte), documentId (unique)
- identityVerified (bool, default false)
- selfieUrl, documentFrontUrl, documentBackUrl (String?)
- walletBalance (Decimal 10,2, default 0)
- subscriptionTier (String: free/premium/elite, default free)
- subscriptionEnds (DateTime?)
- driverScore (Int, default 700)
- totalTrips (Int, default 0), totalKm (Float, default 0)
- role (String: user/admin, default user)
- Relaciones: vehicles[], rentals[] (Renter), bookings[] (Tenant), reviews[], documents[], notifications[], transactions[]
- createdAt, updatedAt

VEHICLE MODEL:
- id (uuid, PK)
- ownerId (FK -> User)
- brand, model, year, plate (unique), color, vin (unique)
- category (car, motorcycle, truck, van, suv, luxury)
- seats (Int), transmission (manual/automatic), fuelType
- photos (String[])
- pricePerHour (Decimal), pricePerDay (Decimal), pricePerKm (Decimal?)
- deposit (Decimal, default 0)
- available (bool, default true)
- locationLat, locationLng (Float?), locationName (String?)
- withDriver (bool, default false), driverPrice (Decimal?)
- mileage (Int, default 0), lastMaintenance (DateTime?)
- insurance (bool, default false), insuranceExpires (DateTime?)
- totalRentals (Int, default 0), rating (Float, default 0)
- restrictions (Json?), features (String[])
- Relaciones: bookings[], reviews[]
- createdAt, updatedAt

BOOKING MODEL:
- id (uuid, PK)
- vehicleId (FK), tenantId (FK -> User como "Tenant")
- startAt, endAt (DateTime), returnedAt (DateTime?)
- withDriver (bool), driverId (uuid?)
- baseAmount, driverFee, insuranceFee, serviceFee, totalAmount, deposit (Decimal)
- hasInsurance (bool), insuranceDetails (Json?), liabilityWaiver (bool)
- trackingEnabled (bool), trackingData (Json?)
- status: pending/confirmed/active/completed/cancelled/disputed
- photosBefore, photosAfter (String[])
- damageReport (Json?)
- paymentStatus: pending/held/released/refunded
- transactionId (String?)
- createdAt, updatedAt

REVIEW MODEL:
- id (uuid, PK)
- bookingId (unique FK), authorId (FK), targetId (FK)
- rating (1-5), comment (String?), categories (Json?)
- createdAt

TRANSACTION MODEL:
- id (uuid, PK)
- fromUserId, toUserId, bookingId (uuid?)
- type: deposit/withdrawal/payment/refund/commission/subscription
- amount, fee (Decimal)
- status: pending/completed/failed/reversed
- description, referenceId (String?)
- createdAt

SUBSCRIPTION MODEL:
- id (uuid, PK)
- userId (unique FK)
- tier (premium/elite), price (Decimal), interval (monthly/yearly)
- autoRenew (bool), startsAt, endsAt, status (active/cancelled/expired)
- benefits (Json)
- createdAt

NOTIFICATION MODEL:
- id (uuid, PK)
- userId (FK), type (String), title, body (String?)
- data (Json?), read (bool, default false), pushSent (bool, default false)
- createdAt

[ENDPOINTS DEL BACKEND]
Implementa EXACTAMENTE estos endpoints con Express + TypeScript:

Auth (/api/auth):
- POST /api/auth/register — body: { email, phone, password, name, lastName, documentType, documentId }
- POST /api/auth/login — body: { email|phone, password } → devuelve JWT
- POST /api/auth/verify-identity — multipart: selfie + documentFront + documentBack (solo almacenar, verificación manual en MVP)
- GET /api/auth/me — perfil del usuario autenticado
- PUT /api/auth/me — actualizar perfil

Vehicles (/api/vehicles):
- GET /api/vehicles — query params: ?category, ?lat, ?lng, ?radius, ?startAt, ?endAt, ?minPrice, ?maxPrice, ?withDriver, ?sort
  - Debe filtrar SOLO vehículos disponibles en las fechas indicadas
  - Si se pasan lat/lng/radius, ordenar por distancia
- GET /api/vehicles/:id — detalle + fechas ocupadas en próximos 30 días
- POST /api/vehicles — body completo del vehículo (requiere auth)
- PUT /api/vehicles/:id — actualizar (solo owner)
- DELETE /api/vehicles/:id — eliminar (solo owner)
- POST /api/vehicles/:id/photos — subir fotos a Supabase Storage
- PUT /api/vehicles/:id/availability — actualizar disponibilidad por fechas

Bookings (/api/bookings):
- GET /api/bookings — mis reservas (como tenant O como owner según query param ?role=tenant|owner)
- GET /api/bookings/:id — detalle
- POST /api/bookings — body: { vehicleId, startAt, endAt, withDriver, hasInsurance, insuranceDetails, liabilityWaiver }
  - Calcular baseAmount (según precio por hora/día + duración)
  - Calcular serviceFee (comisión 15% para la plataforma)
  - Si withDriver, agregar driverFee
  - Si hasInsurance, agregar insuranceFee (tarifa fija: 5 USD/día)
  - totalAmount = baseAmount + driverFee + insuranceFee + serviceFee
  - Si liabilityWaiver = true, marcar en DB
  - Estado inicial: pending
- PUT /api/bookings/:id/confirm — owner confirma (status → confirmed)
- PUT /api/bookings/:id/cancel — cualquiera puede cancelar antes de active
- PUT /api/bookings/:id/start — escanea QR o ingresa PIN de 4 dígitos, status → active
- PUT /api/bookings/:id/photos-before — subir array de fotos (entrega)
- PUT /api/bookings/:id/photos-after — subir array de fotos (devolución)
- PUT /api/bookings/:id/end — owner confirma devolución, status → completed
  - Liberar pago al owner (menos comisión)
  - Actualizar stats del vehículo y del tenant
- POST /api/bookings/:id/dispute — abrir disputa con descripción

Payments (/api/payments):
- GET /api/payments/wallet — balance + últimos 50 movimientos
- POST /api/payments/deposit — body: { amount, stripePaymentMethodId }
- POST /api/payments/withdraw — body: { amount, bankAccount }
- POST /api/payments/hold/:bookingId — retener depósito del tenant
- POST /api/payments/release/:bookingId — liberar pago al owner
- POST /api/payments/refund/:bookingId — reembolsar al tenant

Subscriptions (/api/subscriptions):
- GET /api/subscriptions — lista de planes disponibles con precios (hardcode: premium $9.99/mes, elite $19.99/mes)
- POST /api/subscriptions — body: { tier, interval }
- PUT /api/subscriptions/cancel — cancelar renovación automática

Tracking (/api/tracking):
- POST /api/tracking/:bookingId — body: { lat, lng, timestamp } — solo durante booking activa
- GET /api/tracking/:bookingId — devuelve array de puntos (owner y tenant autenticados)

Reviews (/api/reviews):
- POST /api/reviews — body: { bookingId, targetId, rating, comment, categories }
- GET /api/reviews/:userId — reviews de un usuario

Admin (/api/admin) — solo role=admin:
- GET /api/admin/users — paginado, filtro por verificación
- PUT /api/admin/users/:id/verify — verificar identidad manualmente
- GET /api/admin/vehicles
- GET /api/admin/bookings
- GET /api/admin/transactions
- GET /api/admin/disputes
- PUT /api/admin/disputes/:id/resolve — body: { resolution, refundAmount }
- GET /api/admin/metrics — { totalUsers, totalVehicles, activeBookings, revenueToday, revenueMonth, occupancyRate }

[FRONTEND WEB]
Implementar con React 19 + Vite 6 + Tailwind 4 + TypeScript:

Páginas:
1. **Home** — Hero + búsqueda rápida (ubicación, fechas, tipo vehículo) + vehículos destacados
2. **Login/Register** — formularios con validación
3. **Vehicle List** — mapa + lista de resultados con filtros (categoría, precio, fechas, con/sin chofer)
4. **Vehicle Detail** — galería fotos, especificaciones, calendario disponibilidad, perfil del owner, reviews, botón reservar
5. **Booking Flow** — seleccionar fechas, configurar seguro (con o sin), cláusula de riesgo si no tiene, confirmar pago
6. **Dashboard** — tabs: Mis reservas (como tenant), Mis vehículos alquilados (como owner), Favoritos
7. **Reserva Detail** — timeline visual del estado, botones de acción (confirmar, iniciar, tomar fotos, finalizar), ubicación en mapa si activa
8. **Wallet** — balance, historial transacciones, depositar, retirar
9. **Profile** — editar perfil, subscripción actual, documentos, score
10. **Admin** — tabla usuarios, vehículos, transacciones, métricas, resolver disputas

Componentes clave:
- Layout con navbar responsive + sidebar (mobile drawer)
- VehicleCard (tarjeta para lista)
- BookingTimeline (progreso visual de estados)
- PhotoUploader (tomar fotos desde cámara o galería)
- MapView (mapa con marcadores)
- ReviewStars
- FilterPanel (sidebar con todos los filtros)

Funcionalidad PWA:
- Manifest.json con iconos
- Service worker para push notifications
- Registro de push subscription desde el frontend

[FLUJO DE PAGOS CON WALLET + STRIPE CONNECT]
1. Usuarios sin suscripción:
   - Paga vía Stripe Connect al momento de la reserva
   - Stripe divide automático: monto al owner (menos comisión 15%) + comisión a la plataforma
2. Usuarios con suscripción activa (premium/elite):
   - Pueden usar wallet interna (saldo en tabla Transaction)
   - Pago P2P: el dinero va de la wallet del tenant a la wallet del owner
   - La comisión de plataforma se descuenta automáticamente
3. Depósito:
   - Se retiene al momento de confirmar reserva
   - Se libera al completar el viaje (si no hay disputa)
4. Stripe Connect:
   - Cada owner debe registrar una cuenta Stripe Connect para recibir pagos

[CONSENTIMIENTO DE SEGURO]
Cuando el tenant NO tiene seguro:
- Mostrar cláusula de riesgo clara: "Entiendo que alquilo este vehículo sin cobertura de seguro. Acepto asumir toda responsabilidad por daños, robos o accidentes durante el período de alquiler."
- El tenant debe hacer clic en "Acepto los términos"
- El owner también debe aceptar al momento de confirmar: "Entiendo que el arrendatario no tiene seguro. Acepto alquilar mi vehículo bajo mi propio riesgo."
- Ambos consentimientos se guardan en booking.liabilityWaiver (true) y booking.insuranceDetails (objeto con timestamps de ambas aceptaciones)

[TRACKING GPS DESDE CELULAR]
- Durante el alquiler activo, la app web del tenant envía ubicación cada 30 segundos
- POST /api/tracking/:bookingId con { lat, lng, timestamp }
- El owner ve la ruta en un mapa (Mapbox con polyline)
- El tracking SOLO funciona mientras el booking está en estado "active"
- Al finalizar, los datos de tracking se guardan en booking.trackingData
- Privacidad: los datos se eliminan del endpoint activo al completar, solo queda el histórico

[NOTIFICACIONES PUSH]
- Backend: después de cada cambio de estado en booking, crear Notification + enviar push
- Eventos que disparan push: 
  - Nueva solicitud de reserva (→ owner)
  - Reserva confirmada (→ tenant)
  - Viaje iniciado (→ owner)
  - Viaje finalizado (→ tenant + owner)
  - Nuevo review (→ usuario evaluado)
  - Disputa abierta (→ admin)
- Frontend: service worker registrado, mostrar notificaciones con acción al hacer clic

[CONSIDERACIONES ÉCUADOR]
- Precios en USD (dólar americano, moneda oficial de Ecuador)
- Documentos: cédula de identidad + pasaporte para extranjeros
- SOAT obligatorio: validar que el vehículo tenga SOAT vigente
- Edad mínima para rentar: 21 años (configurable)
- Licencia: tipo B para autos, tipo A para motos

[PLAN DE 7 DÍAS]

DÍA 1:
- Inicializar repo con GitHub
- Configurar backend: Express + TypeScript + Prisma + PostgreSQL
- Implementar modelo de datos COMPLETO en schema.prisma
- Ejecutar migración inicial
- Implementar: Auth endpoints (register, login, me, verify-identity)
- Deploy a Railway funcional

DÍA 2:
- Vehicles CRUD completo con filtros
- Bookings CRUD: crear, confirmar, cancelar, iniciar, finalizar
- Subir fotos a Supabase Storage
- Deploy

DÍA 3:
- Payments: wallet, depósitos Stripe, hold/release/refund
- Subscriptions: planes, comprar, cancelar
- Tracking endpoints
- Reviews endpoints
- Admin endpoints con métricas
- Notificaciones backend
- Deploy

DÍA 4:
- Inicializar frontend web con Vite + React + Tailwind
- Home page con hero + búsqueda
- Login/Register pages
- Vehicle list + mapa
- Vehicle detail page
- Deploy a Netlify

DÍA 5:
- Booking flow completo (seleccionar fechas, seguro, pago)
- Dashboard (mis reservas, mis vehículos)
- Wallet page
- Profile page
- Admin page
- PWA: manifest, service worker, push suscripción
- Deploy

DÍA 6:
- Integración frontend-backend completa
- Probar flujo completo: registro → publicar vehículo → buscar → reservar → pagar → iniciar → tracking → finalizar → review
- Push notifications funcionando
- Responsive design en todas las páginas

DÍA 7:
- Bug fixing
- Performance
- Deploy final Railway + Netlify
- README.md con instrucciones de uso
- Entrega: URL funcional del MVP

## FORMATO DE ENTREGA

Al final del día 7, entrega:
1. URL del repo de GitHub
2. URL del backend en Railway
3. URL del frontend en Netlify
4. README.md con: cómo ejecutar localmente, credenciales de admin de prueba, flujo de usuario paso a paso

## RESTRICCIONES

- NO uses Docker
- NO uses Firebase (excepto FCM para push mobile, opcional)
- NO uses herramientas de pago no especificadas
- NO hagas preguntas — usa tu criterio para cualquier ambigüedad
- TODO debe estar en TypeScript (backend y frontend)
- El código DEBE compilar sin errores

Comienza ahora con el DÍA 1.
