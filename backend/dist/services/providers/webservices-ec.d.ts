import { VerificationProvider, IdentityResult } from '../verification';
interface WebServicesConfig {
    apiKey: string;
    baseUrl: string;
}
export declare class WebServicesEcProvider implements VerificationProvider {
    name: string;
    private config;
    constructor(config?: Partial<WebServicesConfig>);
    get isConfigured(): boolean;
    verificarWhatsApp(telefono: string): Promise<{
        exists: boolean;
        whatsapp: boolean;
        error?: string;
    }>;
    health(): Promise<boolean>;
    consultar(cedula: string): Promise<IdentityResult>;
    private request;
}
export {};
//# sourceMappingURL=webservices-ec.d.ts.map