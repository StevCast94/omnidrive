// ===== config/env.ts =====
// Validacion centralizada de variables de entorno.
// requireEnv() aborta el arranque si falta una variable critica, para evitar
// fallbacks inseguros (p. ej. un JWT_SECRET escrito en el repositorio).

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
  // Firma los tokens de sesion de toda la plataforma. Sin fallback: un
  // secreto por defecto en el repositorio es una cuenta de admin regalada.
  JWT_SECRET: requireEnv('JWT_SECRET'),

  // Pais que sirve esta instancia. Hay un despliegue y una base por pais.
  COUNTRY_CODE: optionalEnv('COUNTRY_CODE', 'EC'),

  // Login con Google. Sin esto solo hay email y contrasena.
  GOOGLE_CLIENT_ID: optionalEnv('GOOGLE_CLIENT_ID'),

  // Correo transaccional (restablecer contrasena).
  RESEND_API_KEY: optionalEnv('RESEND_API_KEY'),
  MAIL_FROM: optionalEnv('MAIL_FROM', 'OmniDrive <no-reply@omnidrive.lat>'),

  // Runtime
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  FRONTEND_URL: optionalEnv('FRONTEND_URL'),
};
