// ===== web/src/lib/pais.ts =====
// Qué país eligió esta persona, y si conviene sugerirle otro.
//
// La regla es que la sugerencia nunca redirige sola. Un dominicano de viaje en
// Quito tiene que poder entrar a su país, y alguien que llega por un enlace
// compartido tiene que ver lo que le compartieron.

const CLAVE = 'omnidrive.pais';
const CLAVE_DESCARTADO = 'omnidrive.pais.sugerencia-descartada';

export function paisRecordado(): string | null {
  try { return localStorage.getItem(CLAVE); } catch { return null; }
}

export function recordarPais(code: string) {
  try {
    localStorage.setItem(CLAVE, code);
    localStorage.removeItem(CLAVE_DESCARTADO);
  } catch { /* modo privado: se volverá a preguntar */ }
}

export function descartarSugerencia() {
  try { localStorage.setItem(CLAVE_DESCARTADO, '1'); } catch { /* da igual */ }
}

function sugerenciaDescartada(): boolean {
  try { return localStorage.getItem(CLAVE_DESCARTADO) === '1'; } catch { return false; }
}

/** El país que sugiere la zona horaria del navegador, si coincide con alguno. */
export function paisPorZonaHoraria(
  paises: Array<{ code: string; timezone: string }>
): string | null {
  try {
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return paises.find(p => p.timezone === zona)?.code ?? null;
  } catch {
    return null;
  }
}

/**
 * Decide si mostrar el aviso de "parece que estás en otro país".
 *
 * Solo cuando las tres cosas se cumplen: la zona horaria apunta a otro país,
 * esta persona no eligió ya uno a mano, y no descartó el aviso antes.
 */
export function paisSugerido(
  paisActualCode: string,
  paises: Array<{ code: string; timezone: string }>
): string | null {
  if (paisRecordado() || sugerenciaDescartada()) return null;

  const sugerido = paisPorZonaHoraria(paises);
  return sugerido && sugerido !== paisActualCode ? sugerido : null;
}
