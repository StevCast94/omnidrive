// ===== web/src/pages/AuthCallback.tsx =====
import { useEffect, useRef } from 'react';
import { useNavigate } from '@/lib/router-exports';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    (async () => {
      try {
        // ── 1. LOG de la URL ──
        const fullUrl = window.location.href;
        const searchStr = window.location.search;
        const hashStr = window.location.hash;
        const urlParams = new URLSearchParams(searchStr);
        const hashFragmentParams = Object.fromEntries(new URLSearchParams(hashStr.replace(/^#\/?/, '')));

        console.log('══════ AuthCallback Debug ══════');
        console.log('full URL:', fullUrl);
        console.log('search:', searchStr);
        console.log('hash:', hashStr);
        console.log('search params (code):', urlParams.get('code'));
        console.log('search params (error):', urlParams.get('error'));
        console.log('hash fragment (access_token):', hashFragmentParams.access_token?.substring(0, 20) + '...');
        console.log('═══════════════════════════════');

        const error = urlParams.get('error') || hashFragmentParams.error;
        if (error) throw new Error(`Google OAuth error: ${error}`);

        // ── 2. Restaurar sesión desde access_token del hash ──
        const code = urlParams.get('code');
        const accessToken = hashFragmentParams.access_token;
        const refreshToken = hashFragmentParams.refresh_token || '';

        if (code) {
          console.log('[AuthCallback] Intercambiando code por sesión...');
          const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchErr) throw new Error(exchErr.message);
        } else if (accessToken) {
          console.log('[AuthCallback] Restaurando sesión desde access_token...');
          const { error: setSessErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessErr) throw new Error(setSessErr.message);
        } else {
          // Esperar a que el SDK procese automáticamente
          console.log('[AuthCallback] Sin parámetros directos. Esperando...');
          await new Promise(r => setTimeout(r, 2000));
        }

        // ── 3. Obtener sesión ──
        const { data: { session }, error: sessErr } = await supabase.auth.getSession();
        if (sessErr || !session) throw new Error('No session: ' + (sessErr?.message || 'unknown'));
        console.log('[AuthCallback] Sesión OK:', session.user.email);

        // ── 4. Crear/obtener perfil en nuestra DB ──
        const token = session.access_token;

        let profile;
        // Primero intentamos me() — si falla (404), llamamos a oauth-profile
        try {
          const { data: meRes } = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          profile = meRes.data;
          console.log('[AuthCallback] Perfil existente encontrado');
        } catch {
          console.log('[AuthCallback] Perfil no existe. Creando...');
          const { data: oauthRes } = await api.post('/auth/oauth-profile', {}, {
            headers: { Authorization: `Bearer ${token}` },
          });
          profile = oauthRes.data;
          console.log('[AuthCallback] Perfil creado:', profile.email);
        }

        if (!profile) throw new Error('No se pudo obtener/crear perfil');

        // ── 5. Actualizar store y redirigir ──
        setUser(profile);
        toast.success(`¡Bienvenido, ${profile.name}!`);
        history.replaceState(null, '', '#/dashboard');
        navigate('/dashboard');

      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        const msg = err?.response?.data?.error || err?.message || 'Error de autenticación';
        toast.error(msg);
        navigate('/login');
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
