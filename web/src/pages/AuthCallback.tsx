// ===== web/src/pages/AuthCallback.tsx =====
import { useEffect, useRef } from 'react';
import { useNavigate, useNavigateDirect } from '@/lib/router-exports';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

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
        const hash = window.location.hash;
        const hashClean = hash.replace(/^#\/?/, '');
        const hashFragmentParams = Object.fromEntries(new URLSearchParams(hashClean));

        const error = hashFragmentParams.error;
        if (error) throw new Error(`Google OAuth error: ${error}`);

        // ── 2. Restaurar sesión ──
        const accessToken = hashFragmentParams.access_token;
        const refreshToken = hashFragmentParams.refresh_token || '';

        if (accessToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }

        // ── 3. Obtener sesión ──
        const { data: { session }, error: sessErr } = await supabase.auth.getSession();
        if (sessErr || !session) throw new Error('No session');
        console.log('[AuthCallback] Sesión OK:', session.user.email);

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

        // ── 5. Redirigir forzadamente (navigateDirect evita hashchange race) ──
        // Si el perfil está incompleto (phone genérico o documentId placeholder),
        // redirigir a /profile para que complete datos
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
        <p className="text-slate-400">Completando autenticación...</p>
      </div>
    </div>
  );
}
