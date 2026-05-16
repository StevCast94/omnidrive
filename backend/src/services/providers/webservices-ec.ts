// ── Provider: WebServices.ec ──────────────────────────────────────────
// Documentación: https://webservices.ec/documentacion
// API Base: https://webservices.ec

import { VerificationProvider, IdentityResult } from '../verification';
import https from 'https';

interface WebServicesConfig {
  apiKey: string;
  baseUrl: string;
}

const DEFAULT_CONFIG: WebServicesConfig = {
  apiKey: process.env.WEBSERVICES_EC_API_KEY || '',
  baseUrl: process.env.WEBSERVICES_EC_BASE_URL || 'https://webservices.ec',
};

export class WebServicesEcProvider implements VerificationProvider {
  name = 'webservices.ec';
  private config: WebServicesConfig;

  constructor(config?: Partial<WebServicesConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  async verificarWhatsApp(telefono: string): Promise<{ exists: boolean; whatsapp: boolean; error?: string }> {
    if (!this.isConfigured) {
      return { exists: false, whatsapp: false, error: 'API key no configurada' };
    }
    try {
      const res = await this.request('GET', '/api/whatsapp_check_phone/' + telefono);
      const data = JSON.parse(res.body);
      if (res.statusCode !== 200) {
        return { exists: false, whatsapp: false, error: data?.message || 'Error en verificación WhatsApp' };
      }
      // Asumiendo estructura de respuesta similar
      return {
        exists: data?.data?.exists ?? data?.exists ?? false,
        whatsapp: data?.data?.whatsapp ?? data?.whatsapp ?? false,
      };
    } catch (e: any) {
      return { exists: false, whatsapp: false, error: e.message };
    }
  }

  async health(): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      const res = await this.request('GET', '/health');
      return res.statusCode === 200;
    } catch {
      return false;
    }
  }

  async consultar(cedula: string): Promise<IdentityResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        cedula,
        nombres: '',
        apellidos: '',
        estado: 'ERROR',
        provedor: this.name,
        error: 'WEBSERVICES_EC_API_KEY no configurada en variables de entorno',
      };
    }

    try {
      const res = await this.request('GET', '/api/cedula/' + cedula);
      const data = JSON.parse(res.body);

      // El 503 del proveedor significa que el servicio público no respondió
      if (res.statusCode === 503 || data.data?.codigo === 503) {
        return {
          success: false,
          cedula,
          nombres: '',
          apellidos: '',
          estado: 'ERROR',
          provedor: this.name,
          error: 'El servicio del Registro Civil no está disponible temporalmente. Intenta más tarde.',
          raw: data,
        };
      }

      if (!data || data.error) {
        return {
          success: false,
          cedula,
          nombres: '',
          apellidos: '',
          estado: 'ERROR',
          provedor: this.name,
          error: data?.message || data?.error || 'Error en la consulta',
          raw: data,
        };
      }

      // La respuesta de WebServices.ec viene en data.data
      const result = data.data || data;

      // Mapear respuesta del proveedor a nuestro formato estandar
      const nombres = result.nombres || result.primer_nombre || result.nombre || '';
      const apellidos = result.apellidos || result.primer_apellido || '';
      const estado = result.estado || result.estado_cedula || 'ACTIVA';

      const success = estado.toUpperCase() === 'ACTIVA';

      return {
        success,
        cedula,
        nombres,
        apellidos,
        estado,
        provedor: this.name,
        raw: result,
      };
    } catch (e: any) {
      return {
        success: false,
        cedula,
        nombres: '',
        apellidos: '',
        estado: 'ERROR',
        provedor: this.name,
        error: e.message || 'Error de conexión con WebServices.ec',
      };
    }
  }

  private request(method: string, path: string, body?: Record<string, unknown>): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.config.baseUrl);
      const postData = body ? JSON.stringify(body) : undefined;

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'OmniDrive/1.0',
        },
        timeout: 15000,
      };

      if (postData) {
        (options.headers as Record<string, string>)['Content-Length'] = Buffer.byteLength(postData).toString();
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode || 500, body: data }));
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });

      if (postData) req.write(postData);
      req.end();
    });
  }
}
