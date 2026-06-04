// ===== web/src/pages/AuthCallback.tsx =====
import { useEffect, useRef } from 'react';
import { useNavigate, useNavigateDirect } from '@/lib/router-exports';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

/**
 * Extrae parametros del hash fragment (formatos posibles):
 *   #/auth/callback#access_token=xxx&token_type=bearer&...
 *   #access_token=xxx&token_type=bearer&...
 */
function parseHashParams(): Record<string, string> {
  const raw = window.location.hash;
  // Buscar el fragmento que empieza con access_token= o code=
  // El hash router pone #/auth/callback#... o directamente #access_token...
  const fragmentIdx = raw.search(/access_token=|code=|error=/);
  if (fragmentIdx === -1) {
    // Fallback: tratar todo el hash como query params
    const clean = raw.replace(/^#\/?/, '') || '';
    // Si contiene '/' es una ruta, no params
    if (clean.includes('/') && !clean.includes('=')) return {};
    try { return Object.fromEntries(new URLSearchParams(clean)); } catch { return {}; }
  }
  const fragment = raw.slice(fragmentIdx);
  try { return Object.fromEntries(new URLSearchParams(fragment)); } catch { return {}; }
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const navigateDirect = useNavigateDirect();
  const { setUser } = useAuthStore();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    (async () => {
      try {
        // ── 1. Leer parámetros del hash ──
        const params = parseHashParams();
        console.log('[AuthCallback] Params found:', Object.keys(params).join(', '));

        const error = params.error;
        if (error) throw new Error(`Google OAuth error: ${error}`);

        // ── 2. Restaurar sesión ──
        const accessToken = params.access_token;
        const refreshToken = params.refresh_token || '';

        if (accessToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }

        // ── 3. Obtener sesión ──
        const { data: { session }, error: sessErr } = await supabase.auth.getSession();
        if (sessErr || !session) throw new Error('No session');
        console.log('[AuthCallback] Session OK:', session.user.email);

        // ── 4. Crear/obtener perfil ──
        const token = session.access_token;
        let profile;

        try {
          const { data: meRes } = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          profile = meRes.data;
        } catch {
          const { data: oauthRes } = await api.post('/auth/oauth-profile', {}, {
            headers: { Authorization: `Bearer ${token}` },
          });
          profile = oauthRes.data;
        }

        if (!profile) throw new Error('No se pudo obtener/crear perfil');

        setUser(profile);

        // ── 5. Redirigir ──
        const needsCompletion = 
          profile.phone === '0000000000' || 
          profile.documentId?.startsWith('oauth-');

        navigateDirect(needsCompletion ? '/profile' : '/dashboard');

      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        navigateDirect('/login');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-cyan-400 mx-auto mb-4" />
        <p className="text-slate-400">Completando autenticacion...</p>
      </div>
    </div>
  );
}
