export interface IdentityResult {
    success: boolean;
    cedula: string;
    nombres: string;
    apellidos: string;
    estado: string;
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
export declare function setProvider(provider: VerificationProvider): void;
export declare function getProvider(): VerificationProvider | null;
export declare function verifyWhatsApp(telefono: string): Promise<WhatsAppResult>;
export declare function verifyIdentity(cedula: string): Promise<IdentityResult>;
export declare function validarCedulaEcuatoriana(cedula: string): boolean;
//# sourceMappingURL=verification.d.ts.map