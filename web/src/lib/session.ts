// ===== web/src/lib/session.ts =====
// Sesion contra el auth propio de OmniDrive.
//
// El access token dura 15 minutos y el refresh 30 dias y rota en cada uso.
// Aqui vive toda la logica de guardarlos y renovarlos, para que el resto de
// la app no sepa nada de tokens.

const CLAVE_ACCESS = 'omnidrive.access';
const CLAVE_REFRESH = 'omnidrive.refresh';

export function getAccessToken(): string | null {
  try { return localStorage.getItem(CLAVE_ACCESS); } catch { return null; }
}

export function getRefreshToken(): string | null {
  try { return localStorage.getItem(CLAVE_REFRESH); } catch { return null; }
}

export function guardarSesion(accessToken: string, refreshToken?: string) {
  try {
    localStorage.setItem(CLAVE_ACCESS, accessToken);
    if (refreshToken) localStorage.setItem(CLAVE_REFRESH, refreshToken);
  } catch { /* modo privado: la sesion durara lo que dure la pestaña */ }
}

export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE_ACCESS);
    localStorage.removeItem(CLAVE_REFRESH);
  } catch { /* nada que borrar */ }
}

export function haySesion(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}

// Una sola renovacion en vuelo: si caducan a la vez cinco peticiones, todas
// esperan al mismo refresh en lugar de gastar cinco y rotarse el token entre
// ellas, que las invalidaria unas a otras.
let renovacionEnCurso: Promise<string | null> | null = null;

export function renovarSesion(baseUrl: string): Promise<string | null> {
  if (renovacionEnCurso) return renovacionEnCurso;

  renovacionEnCurso = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      // fetch directo, no el cliente de axios: si pasara por sus
      // interceptores, un 401 aqui dispararia otra renovacion en bucle.
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { borrarSesion(); return null; }

      const { data } = await res.json();
      if (!data?.accessToken) { borrarSesion(); return null; }

      guardarSesion(data.accessToken, data.refreshToken);
      return data.accessToken as string;
    } catch {
      // Fallo de red: NO se borra la sesion. Quedarse sin internet un momento
      // no deberia echar al usuario de su cuenta.
      return null;
    } finally {
      renovacionEnCurso = null;
    }
  })();

  return renovacionEnCurso;
}
