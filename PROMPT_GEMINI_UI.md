# PROMPT PARA GEMINI — Rediseño UI/UX de OmniDrive

## Contexto del Proyecto

OmniDrive es un marketplace P2P de renta de vehículos en Ecuador (similar a Turo). Stack: React 19 + Vite 6 + Tailwind v4 + TypeScript + Express + Prisma + Supabase.

**URL en producción:** https://omnidrive-production.up.railway.app

## Estado Actual de la UI

Actualmente usa Tailwind con tema oscuro (slate-950, indigo-600, slate-800 borders). Se ve funcional pero genérica — fondos planos, bordes redondeados estándar, animaciones mínimas. No hay logo (usa texto "OD" en un badge). Sin iconografía propia, solo lucide-react.

## LO QUE NECESITO DE GEMINI

### 1. LOGO PNG (VARIANTES)

Generar un logo para OmniDrive con estas especificaciones:

- **Estilo:** Futurista minimalista. Sin dibujos de coches. Sin emojis. Sin curvas orgánicas.
- **Concepto:** Una cinta de Möbius minimalista que forma las letras "OD". La cinta de Möbius representa el ciclo infinito (rentar/devolver/rentar), el movimiento perpetuo, la conectividad sin fin. Las líneas son limpias, precisas, sin curvas orgánicas — pura geometría. Debe evocar velocidad, movimiento, conectividad. Algo que combine con Tesla, SpaceX, marcas japonesas de autos (Lexus, Infiniti).
- **Colores:** Degradado de cian (#06b6d4) a índigo (#6366f1) — los colores actuales del proyecto. Fondo oscuro.
- **Tipografía implícita:** Sans-serif geométrica, sin serifas, sin adornos.
- **Tamaño:** 512x512px para el principal, y un favicon 64x64.
- **Variantes:**
  a) Logo completo: isotipo + texto "OmniDrive" debajo
  b) Isotipo solo: solo el monograma "OD" (para navbar, favicon, avatar)
  c) Versión horizontal: isotipo + texto "OmniDrive" a la derecha

### 2. CÓDIGO — SISTEMA DE DISEÑO COMPLETO

Generar código React + Tailwind v4 + TypeScript para transformar completamente la UI. Todo debe ser funcional, listo para copiar y pegar.

#### 2.1. tokens.css (tema global)

Archivo CSS con custom properties que defina el sistema de diseño:

```css
@layer base {
  :root {
    --color-primary: #06b6d4;        /* cian */
    --color-primary-dark: #0891b2;
    --color-secondary: #6366f1;       /* índigo */
    --color-accent: #22d3ee;          /* cian claro */
    --color-surface: #0f172a;         /* slate-950 */
    --color-surface-raised: #1e293b;  /* slate-800 */
    --color-surface-overlay: rgba(15, 23, 42, 0.85);
    --color-border: 1px solid rgba(148, 163, 184, 0.1);
    --color-text-primary: #f8fafc;
    --color-text-secondary: #94a3b8;
    --color-text-muted: #64748b;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 24px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
    --shadow-glow: 0 0 20px rgba(6, 182, 212, 0.15);
    --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
    --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }
}
```

#### 2.2. Componentes Base (reutilizables)

Generar componentes React listos para copiar:

**a) Button** — Variantes: primary (cian), secondary (índigo), ghost, outline. 
- Estados: idle, hover (brillo sutil), active, loading (spinner), disabled
- Animación: micro-bounce sutil en hover, scale 0.98 en click
- Tamaños: sm, md, lg

**b) Input** — Estilo minimalista.
- Fondo oscuro, borde sutil que brilla en focus (glow cian)
- Label flotante animado
- Estados: error (borde rojo), success (borde verde)

**c) Card** — Contenedor de contenido.
- Fondo raised (slate-800), borde sutil, hover eleva la sombra
- Variante "glass" con backdrop-blur para modales/overlays

**d) Badge** — Etiquetas pequeñas.
- Variantes: cian, índigo, verde (disponible), ámbar, rojo
- Con glow sutil en el color correspondiente

**e) Modal/Dialog** — Fondo overlay con backdrop-blur, animación slide-up + fade, cierre con click fuera y ESC

**f) Skeleton Loader** — Placeholders animados con shimmer effect (gradiente animado)

**g) Toast/Notification** — Notificaciones emergentes estilo glass con blur, animación slide-in desde arriba

**h) Tabs** — Navegación por pestañas con indicador animado (underline deslizante)

**i) Select/Dropdown** — Menú desplegable minimalista con backdrop-blur, animación fade + slide

#### 2.3. Animaciones Globales (CSS)

Definir keyframes para:
- `fadeIn` / `fadeOut`
- `slideUp` / `slideDown`
- `scaleIn` (para modales)
- `shimmer` (para skeletons)
- `glowPulse` (para efectos de brillo en CTAs)
- `float` (flotación suave para elementos decorativos)
- `countUp` (para números en estadísticas)

#### 2.4. Navbar (reemplazar completamente la actual)

**Especificaciones:**
- Fijo arriba, glass effect (backdrop-blur-xl + fondo semi-transparente)
- Logo a la izquierda (isotipo OD + texto OmniDrive)
- Navegación centrada: Inicio, Vehículos, Cómo funciona
- Autenticación a la derecha: si no logged in → botón "Ingresar" outline + "Registrarse" primary
- Si logged in → avatar circular (iniciales), menú dropdown con: Dashboard, Mensajes, Perfil, Cerrar sesión
- Mobile: hamburger menu con animación slide desde la derecha, overlay blur
- Active link: indicador sutil (underline glow)
- Scroll: al hacer scroll hacia abajo, la navbar se encoge ligeramente (reduce padding, reduce font-size)
- Border-bottom que cambia opacidad según scroll (más opaco al scrollear)

**CSS animations específicas:**
- Logo aparece con fadeIn + slideDown al cargar
- Links tienen underline que crece de centro a bordes en hover
- Mobile menu: slide desde derecha con backdrop-blur

#### 2.5. Hero Section (reemplazar la de Home.tsx)

**Especificaciones:**
- Full-width, gradiente animado de fondo (cian a índigo, rotación lenta)
- Patrón de grid geométrico sutil en background (líneas finas)
- Partículas decorativas (círculos pequeños flotando con animación lenta)
- Headline grande (clamp 2.5rem - 5rem) con weight 800
- Subtítulo más pequeño (slate-400)
- CTA principal con glow animation pulsante sutil
- Badge "Nuevo" o feature arriba del headline
- Opcional: grid de cards con estadísticas (vehículos disponibles, usuarios, ciudades)

#### 2.6. Login Page (reemplazar completamente)

**Especificaciones:**
- Diseño limpio, centrado, sin desorden
- Logo arriba
- Inputs con label flotante
- Botón de submit con estado loading (spinner animado)
- Divider "O continúa con" con líneas
- Botón Google (mantener funcionalidad actual)
- Links "Olvidaste contraseña" y "Registrate"
- Animación de entrada: los elementos aparecen con fadeIn secuencial (stagger)

#### 2.7. VehicleCard (mejorar la actual)

**Especificaciones:**
- Card rectangular compacta
- Imagen en modo cover con overlay gradiente en hover
- Badge de categoría (Auto, SUV, Moto, etc.)
- Nombre del vehículo (marca + modelo + año)
- Precio destacado: "desde $XX/día"
- Rating con estrellas
- Indicador de disponibilidad (verde/rojo)
- Hover: elevación sutil + brillo en imagen (scale 1.03)
- Click: navega a detalle

#### 2.8. VehicleDetail page (mejorar la actual)

**Especificaciones:**
- Galería de fotosc on grid asimétrico
- Info del vehículo con iconos minimalistas
- Precio destacado
- Calendario de disponibilidad (fechas)
- Botón "Reservar ahora" flotante en mobile
- Secciones: Descripción, Características, Dueño, Reviews
- Imagen del dueño con avatar circular + score

#### 2.9. Efectos Generales

- **Page transitions:** fade entre páginas (podría ser con AnimatePresence de framer-motion o CSS transitions simples)
- **Scroll reveal:** elementos aparecen al hacer scroll (fadeIn + slideUp)
- **Hover cards:** elevación + sombra + borde glow
- **Loading states:** skeleton shimmer en cards mientras cargan datos
- **Empty states:** ilustración minimalista (texto + icono animado) cuando no hay resultados
- **Error states:** mensaje de error elegante con icono + botón reintentar

## RESTRICCIONES TÉCNICAS

- **CSS:** Tailwind v4 + CSS custom properties. NO Tailwind v3, NO PostCSS config.
- **NO instalar framer-motion ni librerías de animación externas** — todo con CSS animations + Tailwind
- **NO usar emojis en reemplazo de iconos** — usar lucide-react (ya instalado)
- **TEMA OSCURO ESTRICTO** — slate-950 base, slate-800 raised, text white/slate-300
- **Sin emojis** en ninguna parte del UI
- **Código TypeScript** funcional, no pseudocódigo
- Los componentes deben ser copiables directamente a los archivos existentes

## FORMATO DE ENTREGA

1. **Logo:** 3 imágenes PNG (completo, isotipo, horizontal) + favicon
2. **Código:** Archivos listos para copiar:
   - `src/styles/tokens.css` — custom properties y animaciones
   - `src/components/ui/Button.tsx`
   - `src/components/ui/Input.tsx`
   - `src/components/ui/Card.tsx`
   - `src/components/ui/Badge.tsx`
   - `src/components/ui/Modal.tsx`
   - `src/components/ui/Skeleton.tsx`
   - `src/components/ui/Tabs.tsx`
   - `src/components/ui/Select.tsx`
   - `src/components/Navbar.tsx` — reemplazo completo
   - `src/pages/Home.tsx` — hero + featured reemplazo
   - `src/pages/Login.tsx` — reemplazo completo
   - `src/components/VehicleCard.tsx` — mejora
   - `src/pages/VehicleDetail.tsx` — mejora

3. Instrucciones de implementación (orden de reemplazo, qué respaldar antes de cambiar)
