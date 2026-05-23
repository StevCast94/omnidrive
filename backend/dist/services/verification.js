"use strict";
// ── Servicio de Verificación de Identidad ──────────────────────────────
// Strategy pattern: permite cambiar de proveedor (WebServices.ec, etc.)
// sin tocar el resto del código.
Object.defineProperty(exports, "__esModule", { value: true });
exports.setProvider = setProvider;
exports.getProvider = getProvider;
exports.verifyWhatsApp = verifyWhatsApp;
exports.verifyIdentity = verifyIdentity;
exports.validarCedulaEcuatoriana = validarCedulaEcuatoriana;
// Cachea la instancia una vez elegida
let currentProvider = null;
function setProvider(provider) {
    currentProvider = provider;
    console.log(`[Verification] Provider set to: ${provider.name}`);
}
function getProvider() {
    return currentProvider;
}
async function verifyWhatsApp(telefono) {
    if (!currentProvider?.verificarWhatsApp) {
        return { exists: false, whatsapp: false, error: 'WhatsApp verification not supported by current provider' };
    }
    return currentProvider.verificarWhatsApp(telefono);
}
async function verifyIdentity(cedula) {
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
    }
    catch (e) {
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
function validarCedulaEcuatoriana(cedula) {
    if (!cedula || cedula.length !== 10)
        return false;
    if (!/^\d{10}$/.test(cedula))
        return false;
    const provincia = parseInt(cedula.substring(0, 2), 10);
    if (provincia < 1 || provincia > 24)
        return false;
    const tercerDigito = parseInt(cedula[2], 10);
    if (tercerDigito >= 6)
        return false; // 0-5 son personas naturales
    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    const digitoVerificador = parseInt(cedula[9], 10);
    let suma = 0;
    for (let i = 0; i < 9; i++) {
        let valor = parseInt(cedula[i], 10) * coeficientes[i];
        if (valor >= 10)
            valor -= 9;
        suma += valor;
    }
    const esperado = (10 - (suma % 10)) % 10;
    return esperado === digitoVerificador;
}
//# sourceMappingURL=verification.js.map