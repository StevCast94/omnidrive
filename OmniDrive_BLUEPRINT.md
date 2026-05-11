# BLUEPRINT — OmniDrive (Rent-a-Car Marketplace)
**Versión:** 1.0 — 11 Mayo 2026
**Autor:** Timmy ⚡

---

## 1. Resumen Ejecutivo

**OmniDrive** es una plataforma P2P de renta de vehículos con/sin chofer, tipo Airbnb pero adaptada al mercado ecuatoriano. Permite a cualquier persona listar su vehículo (auto, moto, camioneta, furgoneta) para alquilarlo por horas/días a otros usuarios verificados.

### Diferenciadores clave:
- **Pagos P2P con wallet integrada** — los usuarios con suscripción activa pueden pagar directo sin intermediarios de procesamiento
- **Comisión por viaje (Airbnb-style) + suscripciones** — modelo freemium con capas de servicio (tracking satelital, rentador elite)
- **App-only tracking inicial** — el GPS se obtiene del teléfono del arrendatario durante el alquiler
- **Sistema de OmniDrive** — scoring de conductores basado en datos reales de manejo, no solo reviews
- **Seguro opcional con consentimiento bilateral** — si no hay seguro, ambas partes firman cláusula de riesgo

### Stack tecnológico:
| Capa | Tecnología |
|---|---|
| Frontend Web | React 19 + Vite 6 + Tailwind 4 + TypeScript |
| App Móvil | React Native (Expo) |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| DB | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Mapas | Mapbox o Google Maps |
| Pagos | Stripe Connect + Wallet propia |
| Push | Web Push + Firebase Cloud Messaging |
| Hosting | Railway (backend) + Netlify (web) + Expo/EAS (mobile) |

---

## 2. Modelo de Datos

### Tablas principales:

```prisma
// ========== USER MANAGEMENT ==========

model User {
  id            String   @id @default(uuid()) @db.Uuid
  email         String   @unique
  phone         String   @unique
  name          String
  lastName      String
  documentType  String   // cedula, pasaporte
  documentId    String   @unique
  birthDate     DateTime?
  gender        String?  // masculino, femenino, otro
  
  // Verificación
  identityVerified Boolean @default(false)
  selfieUrl        String?
  documentFrontUrl String?
  documentBackUrl  String?
  verifiedAt       DateTime?
  
  // Wallet
  walletBalance Decimal  @default(0) @db.Decimal(10,2)
  
  // Suscripción
  subscriptionTier String  @default("free") // free, premium, elite
  subscriptionEnds DateTime?
  
  // Scoring
  driverScore   Int      @default(700) // 0-1000
  totalTrips    Int      @default(0)
  totalKm       Float    @default(0)
  
  // Roles
  role          String   @default("user") // user, admin
  
  // Relaciones
  vehicles      Vehicle[]
  rentals       Rental[]   @relation("Renter")
  bookings      Booking[]  @relation("Tenant")
  reviews       Review[]
  documents     UserDocument[]
  notifications Notification[]
  transactions  Transaction[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model UserDocument {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  user      User     @relation(fields: [userId], references: [id])
  type      String   // license, insurance, soat, matricula
  url       String
  verified  Boolean  @default(false)
  expiresAt DateTime?
  createdAt DateTime @default(now())
}

// ========== VEHICLE MANAGEMENT ==========

model Vehicle {
  id            String   @id @default(uuid()) @db.Uuid
  ownerId       String   @db.Uuid
  owner         User     @relation(fields: [ownerId], references: [id])
  
  // Identificación
  brand         String
  model         String
  year          Int
  plate         String   @unique
  color         String
  vin           String   @unique // numero chasis
  
  // Clasificación
  category      String   // car, motorcycle, truck, van, suv, luxury
  seats         Int
  doors         Int?
  transmission  String   // manual, automatic
  fuelType      String   // gasoline, diesel, electric, hybrid
  
  // Fotos
  photos        String[] // URLs de imágenes
  
  // Precios
  pricePerHour  Decimal  @db.Decimal(10,2)
  pricePerDay   Decimal  @db.Decimal(10,2)
  pricePerKm    Decimal? @db.Decimal(10,2)
  deposit       Decimal  @default(0) @db.Decimal(10,2)
  
  // Disponibilidad
  available     Boolean  @default(true)
  locationLat   Float?
  locationLng   Float?
  locationName  String?  // descripción de ubicación
  
  // Features
  withDriver    Boolean  @default(false)
  driverPrice   Decimal? @db.Decimal(10,2) // extra si incluye chofer
  
  // Estado
  mileage       Int      @default(0) // kilometraje actual
  lastMaintenance DateTime?
  insurance     Boolean  @default(false)
  insuranceExpires DateTime?
  
  // Stats
  totalRentals  Int      @default(0)
  rating        Float    @default(0)
  
  // Metadata
  restrictions  Json?    // km limit, area restrictions, etc
  features      String[] // bluetooth, gps, ac, etc
  
  // Relaciones
  bookings      Booking[]
  reviews       Review[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ========== BOOKING / RENTAL ==========

model Booking {
  id          String   @id @default(uuid()) @db.Uuid
  vehicleId   String   @db.Uuid
  vehicle     Vehicle  @relation(fields: [vehicleId], references: [id])
  tenantId    String   @db.Uuid
  tenant      User     @relation("Tenant", fields: [tenantId], references: [id])
  
  // Schedule
  startAt     DateTime
  endAt       DateTime
  returnedAt  DateTime? // real return time
  
  // Driver
  withDriver  Boolean  @default(false)
  driverId    String?  @db.Uuid // si aplica
  
  // Pricing
  baseAmount  Decimal  @db.Decimal(10,2)
  driverFee   Decimal  @default(0) @db.Decimal(10,2)
  insuranceFee Decimal @default(0) @db.Decimal(10,2)
  serviceFee  Decimal  @db.Decimal(10,2) // comisión plataforma
  totalAmount Decimal  @db.Decimal(10,2)
  deposit     Decimal  @db.Decimal(10,2)
  
  // Insurance
  hasInsurance Boolean @default(false)
  insuranceDetails Json? // info del seguro del usuario
  liabilityWaiver Boolean @default(false) // aceptó cláusula de riesgo
  
  // Tracking
  trackingEnabled Boolean @default(false) // GPS tracking desde app
  trackingData    Json?    // array de puntos GPS durante el viaje
  
  // Status flow
  status      String   @default("pending") // pending, confirmed, active, completed, cancelled, disputed
  
  // Fotos entrega
  photosBefore String[] // fotos al inicio
  photosAfter  String[] // fotos al devolver
  
  // Damage report
  damageReport Json? // reporte de daños si aplica
  
  // Payment
  paymentStatus String @default("pending") // pending, held, released, refunded
  transactionId String? // ID transacción wallet/stripe
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ========== REVIEWS ==========

model Review {
  id        String   @id @default(uuid()) @db.Uuid
  bookingId String   @unique @db.Uuid
  booking   Booking  @relation(fields: [bookingId], references: [id])
  authorId  String   @db.Uuid
  author    User     @relation(fields: [authorId], references: [id])
  targetId  String   @db.Uuid // reviewed user (tenant or owner)
  
  rating    Int      // 1-5
  comment   String?
  categories Json?  // puntuaciones por categoría: cleanliness, communication, etc
  
  createdAt DateTime @default(now())
}

// ========== WALLET / TRANSACTIONS ==========

model Transaction {
  id          String   @id @default(uuid()) @db.Uuid
  fromUserId  String?  @db.Uuid
  toUserId    String?  @db.Uuid
  bookingId   String?  @db.Uuid
  type        String   // deposit, withdrawal, payment, refund, commission, subscription
  amount      Decimal  @db.Decimal(10,2)
  fee         Decimal  @default(0) @db.Decimal(10,2)
  status      String   @default("pending") // pending, completed, failed, reversed
  description String?
  referenceId String?  // ID externo (Stripe)
  
  createdAt DateTime @default(now())
}

// ========== SUBSCRIPTIONS ==========

model Subscription {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @unique @db.Uuid
  user      User     @relation(fields: [userId], references: [id])
  tier      String   // premium, elite
  price     Decimal  @db.Decimal(10,2)
  interval  String   // monthly, yearly
  autoRenew Boolean  @default(true)
  startsAt  DateTime
  endsAt    DateTime
  status    String   @default("active") // active, cancelled, expired
  
  // Beneficios
  benefits  Json     // lista de features habilitadas
  
  createdAt DateTime @default(now())
}

// ========== NOTIFICATIONS ==========

model Notification {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  user      User     @relation(fields: [userId], references: [id])
  type      String   // booking_request, booking_confirmed, booking_active, payment_received, review_received, etc
  title     String
  body      String?
  data      Json?    // payload para push
  read      Boolean  @default(false)
  pushSent  Boolean  @default(false)
  
  createdAt DateTime @default(now())
}
```

---

## 3. Endpoints del Backend (Express + TypeScript)

### Auth (`/api/auth`)
```
POST   /api/auth/register         — Registro con email/phone + selfie + documento
POST   /api/auth/verify-identity   — Subir foto documento + selfie para verificación
POST   /api/auth/login            — Login email/phone + password
POST   /api/auth/logout
GET    /api/auth/me                — Perfil del usuario autenticado
PUT    /api/auth/me                — Actualizar perfil
```

### Users (`/api/users`)
```
GET    /api/users/:id              — Perfil público de usuario
GET    /api/users/:id/vehicles     — Vehículos de un usuario
GET    /api/users/:id/reviews      — Reviews de un usuario
```

### Vehicles (`/api/vehicles`)
```
GET    /api/vehicles               — Listar vehículos (filtros: category, location, dates, price, withDriver)
GET    /api/vehicles/:id           — Detalle vehículo + calendario disponibilidad
POST   /api/vehicles               — Crear vehículo (owner only)
PUT    /api/vehicles/:id           — Actualizar vehículo
DELETE /api/vehicles/:id           — Eliminar vehículo
POST   /api/vehicles/:id/photos    — Subir fotos
PUT    /api/vehicles/:id/availability — Actualizar disponibilidad

# Filtros disponibles en GET /api/vehicles:
# ?category=car,motorcycle
# ?lat=-0.180&lng=-78.467&radius=20 (cercanía en km)
# ?startAt=2026-05-15T10:00&endAt=2026-05-17T10:00 (disponibilidad)
# ?minPrice=10&maxPrice=100
# ?withDriver=true
# ?features=ac,gps
# ?sort=price_asc|price_desc|rating_desc|distance
```

### Bookings (`/api/bookings`)
```
GET    /api/bookings               — Mis reservas (según rol: como tenant u owner)
GET    /api/bookings/:id           — Detalle reserva
POST   /api/bookings               — Crear solicitud de reserva
PUT    /api/bookings/:id/confirm   — Confirmar reserva (owner)
PUT    /api/bookings/:id/cancel    — Cancelar reserva
PUT    /api/bookings/:id/start     — Marcar como iniciada (código QR o PIN)
PUT    /api/bookings/:id/end       — Marcar como devuelta
PUT    /api/bookings/:id/photos-before — Fotos entrega
PUT    /api/bookings/:id/photos-after  — Fotos devolución
POST   /api/bookings/:id/dispute   — Abrir disputa

# Flujo de estados:
# pending → confirmed → active → completed
#                            → cancelled (cualquier estado)
#                            → disputed
```

### Payments (`/api/payments`)
```
GET    /api/payments/wallet        — Balance y movimientos wallet
POST   /api/payments/deposit       — Recargar wallet (Stripe)
POST   /api/payments/withdraw      — Retirar a cuenta bancaria
POST   /api/payments/hold/:bookingId — Retener depósito
POST   /api/payments/release/:bookingId — Liberar pago al owner
POST   /api/payments/refund/:bookingId — Reembolsar

# Para usuarios sin wallet (no suscripción):
# Los pagos se procesan vía Stripe Connect con split automático
# (comisión para plataforma + monto para owner)
```

### Subscriptions (`/api/subscriptions`)
```
GET    /api/subscriptions          — Planes disponibles
POST   /api/subscriptions          — Comprar suscripción
PUT    /api/subscriptions/cancel   — Cancelar renovación
```

### Tracking (`/api/tracking`)
```
POST   /api/tracking/:bookingId    — Reportar ubicación (desde la app del tenant)
GET    /api/tracking/:bookingId    — Obtener ruta (owner y tenant)
       # Nota: Fase 1 usa GPS del celular del arrendatario.
       # Fase 2: integrar dispositivos OBD-II con API dedicada.
```

### Admin (`/api/admin`)
```
GET    /api/admin/users            — Gestionar usuarios
GET    /api/admin/vehicles         — Gestionar vehículos
GET    /api/admin/bookings         — Gestionar reservas
GET    /api/admin/transactions     — Ver transacciones
GET    /api/admin/disputes         — Gestionar disputas
GET    /api/admin/metrics          — Dashboard con métricas
       # usuarios activos, reservas activas, ingresos, ocupación flota
```

---

## 4. Flujo de Usuario Completo (MVP)

### A. Registro y Verificación
1. Usuario se registra con email + celular
2. Sube selfie + foto de cédula/pasaporte
3. Espera verificación (automática o manual)
4. Score inicial: 700 puntos

### B. Publicar Vehículo (Rentador)
1. Selecciona "Publicar vehículo"
2. Completa: marca, modelo, año, placa, fotos, precio x hora/día
3. Configura: categoría, transmisión, características
4. Define restricciones: límite km, zonas prohibidas
5. Elige si ofrece con chofer
6. Define seguro: si tiene, sube documento; si no, confirma cláusula
7. ¡Publicado!

### C. Buscar y Reservar (Arrendatario)
1. Busca por ubicación + fechas + tipo vehículo
2. Ve resultados en mapa + lista con precios
3. Entra a detalle del vehículo: fotos, especificaciones, rating del dueño
4. Selecciona fechas (por horas o días)
5. Elige con/sin chofer
6. Configura seguro: propio o acepta cláusula de riesgo
7. Confirma reserva → paga (wallet o Stripe)
8. Owner recibe notificación y confirma

### D. Inicio del Alquiler
1. Día del alquiler: tenant llega al lugar
2. Escanea QR o ingresa PIN generado por la app
3. Toma fotos del vehículo (estado actual)
4. Se activa tracking GPS (desde su celular)
5. ¡Viaje iniciado!

### E. Durante el Alquiler
1. Owner puede ver ubicación en tiempo real
2. Alertas si el vehículo sale de zona permitida
3. Tenant puede extender con un tap

### F. Devolución
1. Tenant devuelve vehículo en ubicación acordada
2. Toma fotos de devolución
3. Owner verifica estado y confirma devolución
4. Depósito se libera automáticamente
5. Rating mutuo (tenant → owner, owner → tenant)
6. Pago liberado al owner (menos comisión)

### G. Resolución de Disputas
1. Si hay daños, owner abre disputa dentro de 24h
2. Fotos de entrega vs devolución como evidencia
3. Administrador revisa y decide
4. Si es culpa del tenant, se cobra de depósito

---

## 5. Consideraciones de Seguridad

- **Verificación de identidad obligatoria** para publicar vehículos
- **Selfie + documento** comparados (IA en Fase 2, manual en MVP)
- **Cláusula de consentimiento** si no hay seguro — firmada digitalmente por AMBAS partes
- **Depósito retenido** en wallet durante el alquiler
- **Tracking GPS** solo durante el período de alquiler
- **Geocercas**: notificar si el vehículo sale de área permitida
- **Cortacorriente remoto**: Fase 2 con dispositivo IoT

---

## 6. Plan de Desarrollo (7 días)

| Día | Tareas |
|---|---|
| **Día 1** | Backend: Auth + Users + Vehicles CRUD |
| **Día 2** | Backend: Bookings + Payments + Wallet |
| **Día 3** | Backend: Subscriptions + Tracking + Admin |
| **Día 4** | Frontend Web: Auth + Home + Vehicle list/detail |
| **Día 5** | Frontend Web: Booking flow + Payments + Profile |
| **Día 6** | Integración y pruebas de flujo completo |
| **Día 7** | Deploy Railway + Netlify + pruebas finales |

---

## 7. Instrucciones para el Desarrollador

1. **Backend**: Iniciar con `npm create express-ts` o template similar. Usar Prisma con PostgreSQL. Todos los endpoints deben devolver JSON con `{ data, error }`.
2. **Frontend Web**: Iniciar con `npm create vite@latest` (React + TypeScript). Usar Tailwind CSS. Mapbox para mapas.
3. **Pagos**: Stripe Connect para procesamiento. Wallet propia como tabla `Transaction` en DB. Los usuarios sin suscripción pagan vía Stripe; los suscriptores pueden usar wallet P2P.
4. **Auth**: Supabase Auth para email/phone + JWT. La verificación de identidad es manual en MVP (revisar documentos desde admin panel).
5. **Tracking**: El tenant activa tracking desde su celular en el frontend. Enviar ubicación cada 30 segundos al endpoint POST /api/tracking/:bookingId. El owner ve la ruta en un mapa.
6. **Notificaciones**: Web Push (service worker) para web + Firebase Cloud Messaging para mobile.
7. **Subir a GitHub** cada día. Deploy automático a Railway + Netlify.

---

## 8. Estructura de Archivos Recomendada

```
OmniDrive/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── vehicles.ts
│   │   │   ├── bookings.ts
│   │   │   ├── payments.ts
│   │   │   ├── subscriptions.ts
│   │   │   ├── tracking.ts
│   │   │   ├── reviews.ts
│   │   │   └── admin.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── validate.ts
│   │   └── services/
│   │       ├── stripe.ts
│   │       ├── wallet.ts
│   │       └── tracking.ts
│   ├── package.json
│   └── tsconfig.json
├── web/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── VehicleList.tsx
│   │   │   ├── VehicleDetail.tsx
│   │   │   ├── Booking.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Wallet.tsx
│   │   │   └── Admin.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── package.json
│   └── vite.config.ts
├── mobile/ (React Native - Fase 2, opcional para el MVP)
└── README.md
```
