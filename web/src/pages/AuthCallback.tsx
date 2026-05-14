// ===== web/src/pages/AuthCallback.tsx =====
// Callback después del OAuth de Google.
//
// El flujo es:
//   1. Login.tsx → signInWithOAuth → Google → /auth/callback.html?code=xxx
//   2. callback.html (HTML estático) intercambia code → session en localStorage
//   3. callback.html redirige a /#/auth/callback?access_token=xxx
//   4. Este componente lee la sesión de localStorage y crea el perfil

import { useEffect, useRef } from 'react';
import { useNavigate } from '@/lib/router-exports';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/api';
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
        // ── 1. Esperar que Supabase recoja la sesión de localStorage ──
        // callback.html ya guardó la sesión en 'supabase.auth.token'
        // getSession() debería leerla automáticamente
        await new Promise(r => setTimeout(r, 500));

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          // Forzar setSession desde los parámetros del hash
          const hash = window.location.hash;
          const searchStr = hash.includes('?') ? hash.split('?')[1] : '';
          const params = new URLSearchParams(searchStr);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
          } else {
            throw new Error(sessionError?.message || 'No se pudo obtener la sesión');
          }
        }

        // Re-verificar sesión
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        if (!finalSession) throw new Error('No se pudo establecer la sesión');

        // ── 2. Buscar perfil existente o crear uno nuevo ──
        let profile;
        try {
          const { data: res } = await auth.me();
          profile = res.data;
        } catch {
          // Nuevo usuario desde Google
          const userData = {
            name: finalSession.user.user_metadata?.full_name?.split(' ')[0] || 'Usuario',
            lastName: finalSession.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
            email: finalSession.user.email!,
            phone: finalSession.user.phone || '',
            password: crypto.randomUUID(),
            documentType: 'cedula',
            documentId: '0000000000',
            birthDate: '',
          };
          await auth.register(userData);
          const { data: res } = await auth.me();
          profile = res.data;
        }

        setUser(profile);
        toast.success(`¡Bienvenido, ${profile.name}!`);

        // ── 3. Limpiar hash y redirigir ──
        history.replaceState(null, '', '#/dashboard');
        navigate('/dashboard');
      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        toast.error(err?.message || 'Error al iniciar sesión con Google');
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
