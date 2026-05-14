// ── Provider: WebServices.ec ──────────────────────────────────────────
// Documentación: https://webservices.ec/documentacion
// API Base: https://webservices.ec/api/v1

import { VerificationProvider, IdentityResult } from '../verification';
import https from 'https';

interface WebServicesConfig {
  apiKey: string;
  baseUrl: string;
}

const DEFAULT_CONFIG: WebServicesConfig = {
  apiKey: process.env.WEBSERVICES_EC_API_KEY || '',
  baseUrl: process.env.WEBSERVICES_EC_BASE_URL || 'https://webservices.ec/api/v1',
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
      const res = await this.request('POST', '/cedula/consultar', { numero: cedula });
      const data = JSON.parse(res.body);

      if (!data || data.error) {
        return {
          success: false,
          cedula,
          nombres: '',
          apellidos: '',
          estado: 'ERROR',
          provedor: this.name,
          error: data?.mensaje || data?.error || 'Error en la consulta',
          raw: data,
        };
      }

      // Mapear respuesta del proveedor a nuestro formato estandar
      const nombres = data.nombres || data.primer_nombre || '';
      const apellidos = data.apellidos || data.primer_apellido || '';
      const estado = data.estado || data.estado_cedula || 'ACTIVA';

      const success = estado.toUpperCase() === 'ACTIVA';

      return {
        success,
        cedula,
        nombres,
        apellidos,
        estado,
        provedor: this.name,
        raw: data,
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
        timeout: 10000,
      };

      if (postData) {
        options.headers!['Content-Length'] = Buffer.byteLength(postData).toString();
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
