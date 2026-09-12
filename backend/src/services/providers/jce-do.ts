// ── Provider: JCE (Junta Central Electoral, Republica Dominicana) ─────
//
// Implementa la misma interfaz que webservices.ec, para que el resto del
// codigo no sepa en que pais esta. Todavia sin proveedor contratado: mientras
// `isConfigured` sea false, nunca se registra, y las cedulas dominicanas caen
// en revision manual. Eso es correcto y deliberado: el digito verificador es
// publico y no verifica a nadie.

import { VerificationProvider, IdentityResult } from '../verification';

export class JceDoProvider implements VerificationProvider {
  name = 'jce.do';
  private apiKey = process.env.JCE_DO_API_KEY || '';
  private baseUrl = process.env.JCE_DO_BASE_URL || '';

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  async consultar(cedula: string): Promise<IdentityResult> {
    if (!this.isConfigured) {
      return {
        success: false, cedula, nombres: '', apellidos: '',
        estado: 'ERROR', provedor: this.name,
        error: 'Proveedor JCE no configurado',
      };
    }

    const res = await fetch(`${this.baseUrl}/cedula/${cedula.replace(/\D/g, '')}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      return {
        success: false, cedula, nombres: '', apellidos: '',
        estado: 'ERROR', provedor: this.name,
        error: `El servicio respondió ${res.status}`,
      };
    }

    const d = await res.json() as Record<string, any>;
    return {
      success: Boolean(d.nombres),
      cedula,
      nombres: d.nombres ?? '',
      apellidos: d.apellidos ?? '',
      estado: d.estado ?? 'ACTIVA',
      provedor: this.name,
      raw: d,
    };
  }

  async health(): Promise<boolean> {
    return this.isConfigured;
  }
}
