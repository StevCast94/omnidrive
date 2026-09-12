import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { authRouter }          from './routes/auth';
import { vehiclesRouter }      from './routes/vehicles';
import { usersRouter }         from './routes/users';
import { bookingsRouter }      from './routes/bookings';
import { trackingRouter }      from './routes/tracking';
import { reviewsRouter }       from './routes/reviews';
import { adminRouter }         from './routes/admin';
import { pushRouter }          from './routes/push';
import { notificationsRouter } from './routes/notifications';
import { uploadRouter }        from './routes/upload';
import { metricsRouter }       from './routes/metrics';
import { paymentsRouter }      from './routes/payments';
import { legalRouter }         from './routes/legal';
import { setProvider }         from './services/verification';
import { WebServicesEcProvider } from './services/providers/webservices-ec';
import { JceDoProvider } from './services/providers/jce-do';
import { env }                 from './config/env';
import { origenesPermitidos }  from './config/country';
import { apiLimiter }          from './middleware/rateLimit';

// Sitios de todos los paises: los usan CORS y la CSP, porque el selector de
// pais lee las metricas publicas del otro pais.
const ORIGENES = origenesPermitidos();

const app = express();
const PORT = process.env.PORT || 3000;

// Railway corre detrás de un proxy: necesario para que rate-limit lea la IP real
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      // ...ORIGENES: el selector de pais lee las metricas publicas del otro
      // pais. Permitirlo en CORS no basta; el navegador tambien lo bloquea
      // por CSP si no esta aqui.
      connectSrc: ["'self'", ...ORIGENES, "https://accounts.google.com/gsi/", "https://*.googleusercontent.com", "https://res.cloudinary.com"],
      fontSrc: ["'self'", "https:", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      frameSrc: ["'self'", "https://accounts.google.com/gsi/"],
      // Las teselas del mapa vienen de OpenStreetMap. Sin esto el mapa carga
      // pero se ve en blanco, sin ningun error que lo explique.
      imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://lh3.googleusercontent.com", "https://images.unsplash.com", "https://tile.openstreetmap.org", "https://*.tile.openstreetmap.org"],
      objectSrc: ["'none'"],
      // MapLibre crea sus workers desde blob:
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      scriptSrc: ["'self'", "https://accounts.google.com/gsi/client"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
}));

app.use(cors({
  origin: (origen, cb) => cb(null, !origen || ORIGENES.includes(origen)),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting general para toda la API
app.use('/api', apiLimiter);

// Health check
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date(), env: process.env.NODE_ENV })
);

// API routes
app.use('/api/auth',          authRouter);
app.use('/api/users',         usersRouter);
app.use('/api/vehicles',      vehiclesRouter);
app.use('/api/bookings',      bookingsRouter);
app.use('/api/tracking',      trackingRouter);
app.use('/api/reviews',       reviewsRouter);
app.use('/api/admin',         adminRouter);
app.use('/api/push',          pushRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/upload',        uploadRouter);
app.use('/api/metrics',      metricsRouter);
app.use('/api/payments',     paymentsRouter);
app.use('/api/legal',        legalRouter);


// Serve frontend static files
const publicDir = path.join(__dirname, '..', 'public');

// Vite assets with content hash: immutable cache for 1 year
app.use('/assets', express.static(path.join(publicDir, 'assets'), {
  maxAge: '365d',
  immutable: true,
}));

// Other static files (favicon, manifest, etc.)
app.use(express.static(publicDir, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
  },
}));

// SPA fallback: non-API GET requests -> index.html (React Router handles routing)
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.sendFile(path.join(publicDir, 'index.html'));
});

// 404 for unmatched API routes
app.use('/api', (_req, res) => res.status(404).json({ data: null, error: 'Not found' }));

// Global error handler (catches errors from asyncHandler and other middlewares)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Prisma unique constraint violation
  if (err?.code === 'P2002') {
    const field = err.meta?.target?.join?.(', ') || 'campo unico';
    return res.status(409).json({ data: null, error: `Ya existe otro registro con ese ${field}` });
  }
  // Prisma not found
  if (err?.code === 'P2025') {
    return res.status(404).json({ data: null, error: 'Registro no encontrado' });
  }
  // Multer file size error
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ data: null, error: 'El archivo excede el tamano maximo permitido (10MB)' });
  }
  // JWT errors
  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return res.status(401).json({ data: null, error: 'Token invalido o expirado' });
  }
  console.error('[Error]', err);
  res.status(500).json({ data: null, error: err?.message ?? 'Error interno del servidor' });
});

// Proveedor de verificacion del pais que sirve esta instancia.
// Si no hay ninguno configurado, las verificaciones quedan pendientes de
// revision manual: NUNCA se autoaprueban. El digito verificador de una cedula
// es un algoritmo publico y no verifica a nadie.
const proveedores: Record<string, () => { isConfigured: boolean } & any> = {
  EC: () => new WebServicesEcProvider(),
  DO: () => new JceDoProvider(),
};

const proveedor = proveedores[env.COUNTRY_CODE]?.();
if (proveedor?.isConfigured) {
  setProvider(proveedor);
  console.log(`[Init] Verificacion de identidad: ${proveedor.name}`);
} else {
  console.warn(
    `[Init] SIN proveedor de verificacion para ${env.COUNTRY_CODE}. ` +
    'Las identidades quedaran PENDIENTES de revision manual (nunca se autoaprueban).'
  );
}

// Start
app.listen(PORT, () =>
  console.log(`OmniDrive unified on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`)
);

export default app;