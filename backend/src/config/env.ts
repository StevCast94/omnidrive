// ===== config/env.ts =====
// Validación centralizada de variables de entorno.
// requireEnv() aborta el arranque si falta una variable crítica,
// para evitar fallbacks inseguros (p. ej. JWT_SECRET hardcodeado).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(`[FATAL] Falta la variable de entorno requerida: ${name}`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Secreto para firmar JWT del panel admin (sin fallback inseguro)
  JWT_SECRET: requireEnv('JWT_SECRET'),

  // Supabase
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_KEY: requireEnv('SUPABASE_SERVICE_KEY'),

  // Runtime
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  FRONTEND_URL: optionalEnv('FRONTEND_URL'),

  // Habilita el endpoint de seed (solo dev). Por defecto deshabilitado.
  SEED_ENABLED: optionalEnv('SEED_ENABLED') === 'true',
};
