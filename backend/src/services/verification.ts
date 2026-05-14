// ── Servicio de Verificación de Identidad ──────────────────────────────
// Strategy pattern: permite cambiar de proveedor (WebServices.ec, etc.)
// sin tocar el resto del código.

export interface IdentityResult {
  success: boolean;
  cedula: string;
  nombres: string;
  apellidos: string;
  estado: string; // "ACTIVA", "FALLECIDO", etc.
  provedor: string;
  raw?: Record<string, unknown>;
  error?: string;
}

export interface WhatsAppResult {
  exists: boolean;
  whatsapp: boolean;
  error?: string;
}

export interface VerificationProvider {
  /** Nombre del proveedor (ej: "webservices.ec") */
  name: string;
  /** Consultar una cédula ecuatoriana */
  consultar(cedula: string): Promise<IdentityResult>;
  /** Verificar si número tiene WhatsApp activo */
  verificarWhatsApp?(telefono: string): Promise<WhatsAppResult>;
  /** Health check del proveedor */
  health(): Promise<boolean>;
}

// Cachea la instancia una vez elegida
let currentProvider: VerificationProvider | null = null;

export function setProvider(provider: VerificationProvider): void {
  currentProvider = provider;
  console.log(`[Verification] Provider set to: ${provider.name}`);
}

export function getProvider(): VerificationProvider | null {
  return currentProvider;
}

export async function verifyWhatsApp(telefono: string): Promise<WhatsAppResult> {
  if (!currentProvider?.verificarWhatsApp) {
    return { exists: false, whatsapp: false, error: 'WhatsApp verification not supported by current provider' };
  }
  return currentProvider.verificarWhatsApp(telefono);
}

export async function verifyIdentity(cedula: string): Promise<IdentityResult> {
  if (!currentProvider) {
    return {
      success: false,
      cedula,
      nombres: '',
      apellidos: '',
      estado: 'ERROR',
      provedor: 'none',
      error: 'No hay proveedor de verificación configurado',
    };
  }

  // Validación sintáctica offline primero (dígito verificador)
  if (!validarCedulaEcuatoriana(cedula)) {
    return {
      success: false,
      cedula,
      nombres: '',
      apellidos: '',
      estado: 'INVALIDA',
      provedor: currentProvider.name,
      error: 'El número de cédula no es estructuralmente válido',
    };
  }

  try {
    return await currentProvider.consultar(cedula);
  } catch (e: any) {
    return {
      success: false,
      cedula,
      nombres: '',
      apellidos: '',
      estado: 'ERROR',
      provedor: currentProvider.name,
      error: e.message || 'Error al consultar el proveedor',
    };
  }
}

// ── Validación offline del dígito verificador (módulo 10) ─────────────

export function validarCedulaEcuatoriana(cedula: string): boolean {
  if (!cedula || cedula.length !== 10) return false;
  if (!/^\d{10}$/.test(cedula)) return false;

  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;

  const tercerDigito = parseInt(cedula[2], 10);
  if (tercerDigito >= 6) return false; // 0-5 son personas naturales

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const digitoVerificador = parseInt(cedula[9], 10);

  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let valor = parseInt(cedula[i], 10) * coeficientes[i];
    if (valor >= 10) valor -= 9;
    suma += valor;
  }

  const esperado = (10 - (suma % 10)) % 10;
  return esperado === digitoVerificador;
}
