# OmniDrive — Plan de la Fase Definitiva (Producción · Multipaís)

> **v2 — 11-sep-2026.** Reestructura la v1 para incorporar tres decisiones de Stevens: modelo de monetización **C (híbrido)**, **piloto simultáneo en Ecuador y República Dominicana** con bases de datos separadas por país, y **vista de rastreo en tiempo real sobre mapa**.
> Auditoría base sobre `master@f69cfd1`, producción viva en `https://omnidrive.lat` (Railway). Sucede a `AUDITORIA_2026-06.md`.

---

## 1. Qué hay hoy (estado real verificado)

**Vivo y funcionando**
- Stack unificado: Express + Prisma (Postgres en Supabase) sirviendo también el SPA React 19 + Vite 6 + Tailwind 4. Un solo servicio en Railway. PWA con push.
- Auth vía Supabase (email + Google OAuth), perfil propio en tabla `User`.
- Ciclo de reserva modelado completo: `pending → confirmed → active → completed`, con fotos antes/después, disputa y tracking.
- Panel admin real: dashboard, usuarios, vehículos, reservas, verificación de identidad, cédulas vetadas, roles.
- Verificación de identidad con **patrón de proveedor ya implementado** (`services/verification.ts` + `providers/webservices-ec.ts`) — es la pieza que hace barato añadir un segundo país.
- Backup diario por GitHub Actions (`pg_dump` → Cloudinary). **Funcionó hasta el 04-ago-2026.**

**Cerrado desde la auditoría de junio** ✅
`/api/seed` deshabilitado en producción · `JWT_SECRET` sin fallback · `express-rate-limit` global + estricto en login · `POST /api/reviews` valida autoría y estado · `PUT /api/vehicles/:id` con lista blanca · `requireVerified` en reservas · chequeo de saldo antes de cobrar · índices · `sourcemap:false` + `manualChunks` · `trust proxy`.

**Datos en producción:** 9 vehículos (6 son semilla ficticia del usuario "Carlos" en Quito, con `totalRentals` inventados de 8 a 31), 14 usuarios, 7 reservas. Reales: 3, todos en Santa Elena.

---

## 2. Hallazgos abiertos

### 🔴 Bloqueantes

**B1 — El ciclo de reserva no se puede cerrar. Nadie puede tener saldo.**
`/bookings/:id/end` (`bookings.ts:290`) exige `walletBalance >= totalAmount`, pero **no existe camino para cargar saldo**: sin `routes/payments.ts`, sin `services/wallet.ts`, sin UI de billetera, sin endpoint admin que acredite. Las ramas `feature/stripe-connect` y `feature/messaging` están a **0 commits por delante de master**: están muertas.

**B2 — Backups detenidos desde el 04-ago-2026 (38 días).** GitHub deshabilita los `schedule` tras 60 días sin actividad en el repo.

**B3 — Datos ficticios en producción con reputación inventada.** 6 vehículos con viajes y ratings que nunca ocurrieron.

**B4 — Cifras del hero hardcodeadas** (`Home.tsx:102`) mientras `/api/metrics` —público y sin auth— devuelve las reales y nadie lo consume.

**B5 — `prisma db push --accept-data-loss` en cada deploy**, sin migraciones versionadas.

**B6 — Verificación de identidad falsificable:** sin `WEBSERVICES_EC_API_KEY`, `auth.ts:187` aprueba con sólo el dígito verificador de la cédula.

**B7 — No existe ningún mapa.** `mapbox-gl` y `react-map-gl` están instalados y tienen chunk propio en `vite.config.ts`, pero **0 imports en todo el frontend**. El rastreo escribe puntos y `BookingDetail.tsx` los consulta por polling, pero no hay dónde dibujarlos. *(Nuevo en v2 — en la v1 estaba subestimado como "sin geolocalización".)*

**B8 — El rastreo actual no sirve para tiempo real.** `getCurrentPosition` cada 30s (no `watchPosition`), cada punto hace *read-modify-write* del blob `Booking.trackingData` — carrera de escrituras y crecimiento sin límite en una columna JSON sin índice —, sin buffer offline (en carretera la señal cae), sin consentimiento explícito y sin política de retención de un dato personal sensible en ambas jurisdicciones. *(Nuevo en v2.)*

### 🟡 Importantes

Seguro inexistente (`Vehicle.insurance` es un booleano auto-declarado; `insuranceExpires` nunca se valida) · sin términos, privacidad ni política de cancelación (hoy reembolsa 100% siempre) · `Conversation`/`Message` en el esquema sin ruta ni pantalla, la conversación real se va a WhatsApp y no queda evidencia para disputas · sin facturación electrónica · sin `AuditLog` · atomicidad parcial en `/end` · `calcBase` (`bookings.ts:18`) fija el precio con redondeo confuso y cero tests · `pages.yml` publica una copia stale del front en GitHub Pages · los 3 vehículos reales tienen `locationLat: null` · claves Supabase hardcodeadas en `web/src/lib/supabase.ts` en vez de `import.meta.env` — **esto último bloquea directamente el multipaís**.

---

## 3. Modelo de negocio: decisión tomada

**Opción C — híbrido por fases.** Lanzar con suscripción de anfitrión + depósito de garantía dentro de la app; la comisión sobre el alquiler llega en F8, con seguro y volumen. El copy pasa de «sin comisiones» a **«sin comisión sobre tu alquiler»**: sigue siendo cierto y diferencia frente al rent-a-car tradicional.

Lo que esto corrige: hoy la landing promete «sin comisiones» y «coordinación directa por WhatsApp», lo que convierte a OmniDrive en un tablón de anuncios, mientras todo el modelo de datos (wallet, `serviceFee`, `Transaction`, `Subscription`) está construido para lo contrario.

---

## 4. Arquitectura multipaís

### 4.1 La decisión estructural

Tres formas de soportar dos países:

| | Aislamiento | Riesgo de fuga | Coste infra | Complejidad de código |
|---|---|---|---|---|
| **A. Una BD, columna `countryCode`** | lógico | alto — cada query nueva puede olvidar el filtro | mínimo | filtro obligatorio en todas partes |
| **B. Un servicio, varias BD por host** | físico | medio — pooling de Prisma por tenant es frágil | bajo | enrutado de conexión no trivial |
| **C. Un servicio por país** | físico y total | ninguno | +1 servicio, +1 proyecto Supabase | config por país, cero lógica de tenant |

**Recomendación: C.** Mismo repo, misma imagen, dos despliegues Railway con distintas variables de entorno. Razones: es lo que pediste (bases bien diferenciadas), elimina por construcción la fuga entre países, **Supabase Auth es por proyecto** — con la opción A los usuarios de ambos países compartirían el mismo pool de identidades, que es justo lo que no quieres cuando la verificación es por cédula nacional —, y permite backups, borrado y retención por jurisdicción, que es exactamente lo que exigen la LOPDP ecuatoriana y la Ley 172-13 dominicana. Además un incidente en un piloto no toca al otro.

Lo que se paga: un panel admin por país (la consola global unificada llega en F8, leyendo los `/api/metrics` de ambos) y disciplina para que la config viva en datos, no en `if (country === 'EC')` repartidos por el código.

```
                  omnidrive.com  ──►  selector de país (estático, ligero)
                      │
        ┌─────────────┴─────────────┐
   omnidrive.lat                omnidrive.com.do
   Railway svc EC               Railway svc DO
   Supabase EC  ◄── separadas ──► Supabase DO
```

### 4.2 Selector de país

- **Página raíz** en el dominio neutro: dos tarjetas, bandera, ciudad de referencia y número real de vehículos de cada país (desde `/api/metrics/public` de cada servicio). Sugerencia por geo-IP (cabecera de Railway o Cloudflare), **nunca redirección forzada** — un dominicano de viaje en Quito debe poder entrar a su país.
- Elección recordada en `localStorage` + cookie de dominio raíz; enlace «cambiar de país» siempre visible en el pie.
- Cada servicio arranca con `COUNTRY_CODE` y se auto-describe: bandera, moneda, prefijo telefónico, tipo de documento, ciudades sugeridas.
- SEO: `hreflang` entre los dos dominios; la raíz no compite con ninguno.

### 4.3 `CountryConfig` — todo lo que cambia entre países

| | 🇪🇨 Ecuador | 🇩🇴 República Dominicana |
|---|---|---|
| Moneda | USD | **DOP** (y USD para turistas) |
| Impuesto | IVA 15% | ITBIS 18% |
| Documento | cédula 10 díg. (módulo 10) | cédula 11 díg. (JCE) · **pasaporte para turistas** |
| Verificación | webservices.ec (ya implementado) | proveedor JCE/padrón por contratar |
| Pasarela | PayPhone / Datafast | Azul, CardNET, tPago · **Stripe para tarjeta extranjera** |
| Facturación | SRI vía PAC (Datil, Contífico) | DGII — e-CF / NCF |
| Teléfono | +593 | +1 809 / 829 / 849 |
| Ley de datos | LOPDP | Ley 172-13 |
| Mercado piloto | Santa Elena / Ruta del Spondylus | Bávaro–Punta Cana o Santo Domingo |

### 4.4 La diferencia de producto que RD impone

En Ecuador el arrendatario es local y se verifica con cédula. En República Dominicana el mercado que paga es **el turista**: llega a Punta Cana, alquila 4 días y paga en USD con tarjeta extranjera. Ese usuario **no tiene cédula dominicana**, así que el único camino de verificación que existe hoy no le aplica.

Esto obliga a un **segundo camino de verificación**: pasaporte + licencia de conducir de su país + selfie con prueba de vida, con revisión manual al inicio y un proveedor internacional (Sumsub, Veriff, Didit) cuando haya volumen. No es configuración, es una rama nueva del flujo de onboarding — y es la pieza que más subestimaría un plan que tratara a RD como «Ecuador con otra bandera».

Consecuencias en cadena: la licencia extranjera hay que validarla contra la normativa dominicana de conducción para turistas; el seguro por viaje tiene que cubrir a un conductor no residente; y el depósito de garantía sobre tarjeta internacional hace que **Stripe sí tenga sentido en RD**, cuando en Ecuador no lo tenía.

### 4.5 Impacto en el esquema — hay que decidirlo antes de la primera migración

Estas columnas deben entrar en la **misma primera migración versionada** de F0, o se migra dos veces:

- `Vehicle.countryCode`, `User.countryCode` — aunque las BD estén separadas, el dato viaja en backups, exportaciones y en la consola global futura.
- **Dinero en centavos enteros** (`Int`) en lugar de `Decimal(10,2)`, más `currency` explícito en `Booking`, `Transaction` y `Subscription`. Con dos monedas, un `Decimal` sin moneda es una bomba de tiempo; además es la directiva que ya seguimos en MUEVE.
- `User.documentType` pasa a admitir `passport` y aparece `User.documentCountry`.
- `AuditLog` y `TrackingPoint` (ver §5) — mejor en la misma migración.

---

## 5. Rastreo en tiempo real sobre mapa

### 5.1 Qué hay que construir

**El mapa no existe.** Mapbox está instalado, chunkeado y sin usar. Se construye una vez y sirve a tres cosas: búsqueda por cercanía (hoy imposible, los vehículos reales no tienen coordenadas), ubicación de recogida y entrega, y la vista en vivo.

**El transporte.** El rastreo actual escribe cada punto haciendo read-modify-write de una columna JSON: dos escrituras simultáneas se pisan y la columna crece sin límite. Se reemplaza por:

- Modelo `TrackingPoint` — `bookingId`, `lat`, `lng`, `speed`, `heading`, `accuracy`, `recordedAt` — con índice `(bookingId, recordedAt)` y retención automática de 90 días.
- **Captura:** `watchPosition` con filtro de distancia (no emitir si el vehículo está parado), buffer en IndexedDB y envío por lotes cada 15–30s. En carretera la señal cae; sin buffer se pierde el tramo. Intervalo adaptativo para no fundir la batería.
- **Entrega en vivo:** **SSE** (`GET /api/tracking/:id/stream`) desde el propio Express — cero infraestructura nueva, funciona detrás del proxy de Railway —, con polling como fallback. Supabase Realtime es la alternativa, pero obliga a exponer la tabla vía RLS cuando hoy todo el acceso pasa por el backend con service_role; no compensa.
- **Vista:** marcador del vehículo con rumbo, rastro del recorrido, velocidad, distancia recorrida y sello de «última actualización hace N s» — ese sello es obligatorio: un mapa en vivo que se congela sin avisar es peor que no tenerlo.

### 5.2 Lo que no es negociable (y no es técnico)

La geolocalización de una persona es dato personal sensible bajo la LOPDP ecuatoriana y la Ley 172-13 dominicana. El rastreo se implementa con:

- **Consentimiento explícito del inquilino** al iniciar la reserva, registrado con fecha e IP. No se activa por defecto.
- Sólo mientras la reserva está `active`; se apaga solo al completar, sin excepción.
- Visible **únicamente** para el dueño de ese vehículo y el propio inquilino. El admin ve que existe rastreo, no la traza, salvo disputa abierta y con el acceso registrado en `AuditLog`.
- Aviso persistente en la app del inquilino: «tu ubicación se comparte con el dueño durante este alquiler».
- Retención 90 días y borrado; exportación a petición del titular.

### 5.3 El valor que desbloquea

Geocerca opcional: el dueño define un radio o una zona y recibe un aviso si el vehículo sale. En Ecuador reduce el miedo a entregar el auto, que es la objeción número uno del anfitrión. En República Dominicana, con un turista al volante, es el argumento que hace que un dominicano acepte publicar su vehículo — y es exactamente lo que un rent-a-car tradicional no ofrece.

---

## 6. Plan reestructurado

Nueve fases. Cambio principal respecto a la v1: la internacionalización se adelanta **antes** del ciclo de dinero, porque moneda, impuesto y pasarela son config de país; y el mapa deja de ser un detalle de F3 para ser una fase con peso propio.

| Fase | Qué cierra | Días |
|---|---|---|
| F0 | Estabilizar + esquema definitivo | 2–3 |
| F1 | Núcleo multipaís + selector | 4–5 |
| F2 | Ciclo de dinero (desbloquea B1) | 5–7 |
| F3 | Confianza y verificación (2 caminos) | 4–6 |
| F4 | Mapa y rastreo en vivo | 5–7 |
| F5 | Producto listo para mostrar | 3–4 |
| F6 | Piloto Ecuador — puerta de salida | 2 sem |
| F7 | Infra y piloto RD | 5 d + 2 sem |
| F8 | Monetización, facturación, seguro, escala | — |

### F0 — Estabilizar y fijar el esquema *(2–3 días)*
1. Reactivar el backup y **restaurar un dump real en una BD desechable**. Un backup sin restore probado no es un backup.
2. `prisma db push --accept-data-loss` → `prisma migrate deploy`. La **primera migración** incorpora `add_indexes.sql` y **todo el §4.5 de una vez**: `countryCode`, dinero en centavos + `currency`, `documentCountry`, `AuditLog`, `TrackingPoint`.
3. Proteger `/api/metrics`; abrir `/api/metrics/public` (lo alimenta el selector de país).
4. Sacar las claves Supabase de `web/src/lib/supabase.ts` a `import.meta.env` — sin esto no hay dos entornos.
5. Borrar `pages.yml`, las ramas muertas, `scripts/backup-db.js`; limpiar la raíz.

### F1 — Núcleo multipaís *(4–5 días)*
6. `config/country.ts`: `CountryConfig` con moneda, impuesto, documento, prefijo, pasarela, proveedor de verificación, ciudades y textos legales. El servicio arranca leyendo `COUNTRY_CODE` y falla si la config no existe.
7. Formateo de moneda, fecha, teléfono y documento derivado de la config — nunca hardcodeado. Validador de documento pluggable (módulo 10 EC / JCE RD / pasaporte).
8. Página de selección de país en el dominio neutro, con conteos reales y sugerencia por geo-IP sin redirección forzada.
9. Segundo entorno completo: proyecto Supabase DO + servicio Railway DO + dominio, desplegado **vacío y sin publicar** — se valida el pipeline ahora, no en F7. Backup diario independiente por país.
10. Auditoría de copy: todo lo que hoy dice «Ecuador» o asume USD sale a la config.

### F2 — Cerrar el ciclo de dinero *(5–7 días)* ← **desbloquea B1**
11. `services/wallet.ts` con `hold / release / refund / credit`, todo en `$transaction`, `Transaction` como libro mayor, saldo nunca negativo, importes en centavos con moneda explícita.
12. Interfaz `PaymentProvider` — mismo patrón que `VerificationProvider`, que ya funciona — con **PayPhone** (EC) y **Azul + Stripe** (DO) como implementaciones. Webhook firmado; acreditar sólo tras confirmación del proveedor.
13. `routes/payments.ts` + pantalla de billetera: recarga, saldo, movimientos, retiro manual.
14. Mover el cobro: **retener al confirmar**, no cobrar al finalizar. Nadie entrega un auto sin fondos retenidos.
15. `totalTrips`/`totalRentals` dentro de la transacción de `/end`.

### F3 — Confianza y verificación *(4–6 días)*
16. Activar webservices.ec en producción y **bloquear el modo offline cuando `NODE_ENV=production`**: que quede `pending` en vez de auto-aprobar.
17. **Segundo camino de verificación** (§4.4): pasaporte + licencia extranjera + selfie, con cola de revisión manual en el admin. Es requisito para abrir RD.
18. Proveedor de verificación dominicano (JCE/padrón) detrás de la misma interfaz.
19. `AuditLog` de toda acción admin sobre usuarios, verificaciones, reservas, dinero y accesos a trazas de ubicación.
20. Términos, privacidad y cancelación **por país** (LOPDP / 172-13), con aceptación registrada con fecha e IP.
21. Limpiar los datos ficticios de producción.

### F4 — Mapa y rastreo en tiempo real *(5–7 días)*
22. Componente de mapa (Mapbox, ya instalado): búsqueda por cercanía, ubicación de recogida, y geolocalización **obligatoria** al publicar un vehículo.
23. `TrackingPoint` + reescritura de `routes/tracking.ts`: adiós al blob JSON.
24. Captura móvil: `watchPosition`, filtro de distancia, buffer IndexedDB, envío por lotes.
25. Entrega en vivo por SSE con fallback a polling, y sello de «última actualización».
26. Consentimiento, visibilidad restringida, apagado automático y retención de 90 días (§5.2).
27. Geocerca opcional con aviso push al dueño.

### F5 — Producto listo para mostrar *(3–4 días)*
28. Hero con métricas reales por país; si la cifra es pobre, se oculta — no se inventa.
29. Mensajería interna sobre `Conversation`/`Message`, con push. WhatsApp pasa a secundario y sólo tras reserva confirmada.
30. Tests de `calcBase`, transiciones de reserva, wallet y conversión de moneda. Sin esto no se vuelve a tocar el precio.
31. `React.lazy` por ruta y Lighthouse en móvil — el tráfico será mayoritariamente móvil, y en RD buena parte en roaming.

### F6 — Piloto Ecuador *(2 semanas de operación)* — puerta de salida
32. Meta antes de abrir RD: **25 vehículos reales verificados y 20 reservas completadas** en Santa Elena.
33. Onboarding asistido de anfitriones; las fotos buenas son la mitad de la conversión.
34. Métricas: iniciadas contra completadas, tiempo a confirmación, cancelación, ingreso por vehículo, % de reservas con rastreo activo.

### F7 — Infraestructura y piloto RD *(5 días + 2 semanas)*
35. Activar el entorno DO ya desplegado en F1: dominio, pasarela Azul, proveedor de verificación, textos legales, moneda DOP.
36. Contenido y copy para el mercado turístico: precios en USD y DOP, tramos de 3–7 días, entrega en aeropuerto.
37. Semilla real de anfitriones en Bávaro–Punta Cana o Santo Domingo. **Ningún dato ficticio, ni para demo.**
38. Mismo umbral de salida que Ecuador antes de invertir en captación.

### F8 — Monetización, facturación y escala
39. Suscripciones sobre el modelo `Subscription` que ya existe: free = 1 vehículo; premium/elite = varios, destacado e insignia «Empresa Verificada» (`isBusiness`), con el límite aplicado en `POST /api/vehicles`.
40. Facturación electrónica **por país**: SRI vía PAC en Ecuador, e-CF/NCF de la DGII en RD, detrás de una interfaz común.
41. Seguro por viaje con aseguradora local en cada país; el `insuranceFee` ya está modelado. En RD la póliza debe cubrir conductor no residente.
42. Resolución de disputas con la evidencia que ya se captura — fotos antes/después y ahora la traza GPS — y cargo contra el depósito retenido.
43. Paso de C a A: comisión sobre el alquiler, con seguro y volumen.
44. **Consola global**: un panel que lee los `/api/metrics` de ambos países. Es la deuda que paga la arquitectura elegida, y sólo vale la pena cuando los dos pilotos estén vivos.

---

## 7. Recomendación sobre la simultaneidad

**Construir la arquitectura multipaís ahora; lanzar los pilotos escalonados.**

Hacer el código *country-ready* en F0-F1 es barato — la config por país, el selector y el segundo entorno son 4-5 días — y hacerlo después es retrabajo caro: obliga a una segunda migración de esquema y a reescribir cada punto donde el dinero, el documento o el copy asumen Ecuador.

Operar los dos pilotos a la vez es otra cosa. Duplica lo que no se puede automatizar: captar y fotografiar anfitriones, revisar verificaciones a mano, responder disputas, negociar con una aseguradora y un PAC distintos en cada país. Con un solo equipo, dos pilotos simultáneos significan dos pilotos mediocres.

**Secuencia propuesta:** RD queda técnicamente listo y desplegado en F1, se abre en F7, unas 3-4 semanas después del arranque en Ecuador — salvo que haya un socio operativo en República Dominicana que pueda llevar el onboarding y la verificación manual desde el día uno. Si lo hay, F7 se solapa con F6 y los dos pilotos corren en paralelo.

**Calendario aproximado:** Ecuador en vivo en ~5 semanas de desarrollo; República Dominicana 3-4 semanas después.

---

## 8. Si sólo se pudiera hacer una cosa esta semana

F0 completo. No por urgencia de seguridad, sino porque **la primera migración versionada fija el esquema**: si sale sin `countryCode`, sin dinero en centavos con moneda y sin `TrackingPoint`, todo lo demás se migra dos veces. Y en el mismo golpe se recupera el backup, que lleva 38 días sin correr.
