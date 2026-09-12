// ===== config/country.ts =====
// Hay un despliegue y una base de datos por pais. Esta instancia sirve a uno
// solo, el que diga COUNTRY_CODE, y todo lo que cambia entre paises vive aqui
// como dato: nunca un `if (pais === 'EC')` repartido por las rutas.

export type CountryCode = 'EC' | 'DO';

export interface CountryConfig {
  code: CountryCode;
  name: string;
  flag: string;
  locale: string;
  timezone: string;

  /** Moneda en la que se publican los precios de este pais. */
  currency: string;
  currencySymbol: string;
  /** Monedas adicionales que se aceptan al cobrar (turismo). */
  acceptedCurrencies: string[];

  /** Impuesto al consumo, en puntos porcentuales. */
  taxRate: number;
  taxName: string;

  phonePrefix: string;
  /** Prefijos de movil validos tras el codigo de pais. */
  mobilePrefixes: string[];

  /** Documentos con los que se puede verificar identidad en este pais. */
  documentTypes: Array<'cedula' | 'passport'>;
  /** Proveedor de verificacion contra el registro civil. */
  verificationProvider: string | null;

  /** Pasarelas de pago habilitadas, en orden de preferencia. */
  paymentProviders: string[];
  /** Emisor de comprobantes fiscales. */
  invoicing: string;

  /** Ley de proteccion de datos aplicable, para los textos legales. */
  dataProtectionLaw: string;

  /** Mercado del piloto: donde esta el inventario real. */
  pilotArea: string;
  /** Ciudades sugeridas al publicar un vehiculo. */
  cities: string[];

  /**
   * Donde vive el sitio de este pais. Lo usa el selector de pais y la lista
   * de origenes permitidos por CORS. Se puede sobrescribir con SITE_URL_<CODIGO>
   * sin tocar el codigo, que es lo que hara falta cuando RD tenga dominio propio.
   */
  siteUrl: string;
}

const EC: CountryConfig = {
  code: 'EC',
  name: 'Ecuador',
  flag: '🇪🇨',
  locale: 'es-EC',
  timezone: 'America/Guayaquil',

  currency: 'USD',
  currencySymbol: '$',
  acceptedCurrencies: ['USD'],

  taxRate: 15,
  taxName: 'IVA',

  phonePrefix: '+593',
  mobilePrefixes: ['9'],

  documentTypes: ['cedula'],
  verificationProvider: 'webservices.ec',

  paymentProviders: ['payphone'],
  invoicing: 'sri',

  dataProtectionLaw: 'Ley Orgánica de Protección de Datos Personales (LOPDP)',

  siteUrl: process.env.SITE_URL_EC || 'https://omnidrive.lat',
  pilotArea: 'Santa Elena / Ruta del Spondylus',
  cities: ['Santa Elena', 'Salinas', 'La Libertad', 'Montañita', 'Manglaralto', 'Guayaquil', 'Quito'],
};

const DO: CountryConfig = {
  code: 'DO',
  name: 'República Dominicana',
  flag: '🇩🇴',
  locale: 'es-DO',
  timezone: 'America/Santo_Domingo',

  // Los precios se publican en pesos, pero el turista paga en dolares con
  // tarjeta extranjera: por eso el cobro acepta ambas.
  currency: 'DOP',
  currencySymbol: 'RD$',
  acceptedCurrencies: ['DOP', 'USD'],

  taxRate: 18,
  taxName: 'ITBIS',

  phonePrefix: '+1',
  mobilePrefixes: ['809', '829', '849'],

  // El arrendatario que paga en RD es el turista, y no tiene cedula
  // dominicana. Sin el pasaporte como via de verificacion, el mercado que
  // sostiene el piloto no puede ni reservar.
  documentTypes: ['cedula', 'passport'],
  verificationProvider: null, // pendiente: proveedor JCE

  paymentProviders: ['azul', 'stripe'],
  invoicing: 'dgii',

  dataProtectionLaw: 'Ley 172-13 de Protección de Datos Personales',

  siteUrl: process.env.SITE_URL_DO || 'https://omnidrive-do-production.up.railway.app',
  pilotArea: 'Bávaro – Punta Cana',
  cities: ['Punta Cana', 'Bávaro', 'Higüey', 'Santo Domingo', 'Santiago', 'Samaná', 'Las Terrenas', 'Puerto Plata'],
};

const COUNTRIES: Record<CountryCode, CountryConfig> = { EC, DO };

/** Todos los paises donde opera OmniDrive. Lo consume el selector de pais. */
export function todosLosPaises(): CountryConfig[] {
  return Object.values(COUNTRIES);
}

/** Origenes permitidos por CORS: los sitios de todos los paises. */
export function origenesPermitidos(): string[] {
  return todosLosPaises().map(p => p.siteUrl);
}

export function getCountry(code: string): CountryConfig {
  const found = COUNTRIES[code as CountryCode];
  if (!found) {
    // Arrancar con un pais desconocido significa servir precios, impuestos y
    // verificacion equivocados. Mejor no arrancar.
    console.error(
      `[FATAL] COUNTRY_CODE="${code}" no reconocido. Valores validos: ${Object.keys(COUNTRIES).join(', ')}`
    );
    process.exit(1);
  }
  return found;
}

// ── Validacion de documento por pais ──────────────────────────────────

/** Cedula ecuatoriana: 10 digitos, modulo 10 con coeficientes 2/1. */
export function validarCedulaEC(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = Number(cedula.slice(0, 2));
  if (provincia < 1 || provincia > 24) return false;
  if (Number(cedula[2]) > 5) return false;

  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let v = Number(cedula[i]) * (i % 2 === 0 ? 2 : 1);
    if (v > 9) v -= 9;
    suma += v;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === Number(cedula[9]);
}

/** Cedula dominicana: 11 digitos, modulo 10 con coeficientes 1/2 (JCE). */
export function validarCedulaDO(cedula: string): boolean {
  const limpia = cedula.replace(/\D/g, '');
  if (!/^\d{11}$/.test(limpia)) return false;

  let suma = 0;
  for (let i = 0; i < 10; i++) {
    let v = Number(limpia[i]) * (i % 2 === 0 ? 1 : 2);
    if (v > 9) v -= 9;
    suma += v;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === Number(limpia[10]);
}

/**
 * Valida el numero de documento segun pais y tipo.
 *
 * Importante: que el numero sea estructuralmente valido NO verifica a nadie.
 * El digito verificador es un algoritmo publico; cualquiera genera un numero
 * que pasa. La verificacion real la da el proveedor del registro civil, o la
 * revision manual del documento y la selfie.
 */
export function validarDocumento(
  pais: CountryCode,
  tipo: 'cedula' | 'passport',
  numero: string
): boolean {
  if (tipo === 'passport') {
    // No hay algoritmo universal de pasaporte: solo formato razonable.
    // Estos SIEMPRE pasan por revision manual.
    return /^[A-Z0-9]{6,12}$/i.test(numero.trim());
  }
  return pais === 'EC' ? validarCedulaEC(numero) : validarCedulaDO(numero);
}

// ── Dinero ────────────────────────────────────────────────────────────
// Todo importe viaja y se guarda en centavos enteros. Con dos monedas, un
// decimal sin moneda es una bomba de tiempo.

export function formatearDinero(centavos: number, config: CountryConfig): string {
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
  }).format(centavos / 100);
}
