// ===== web/src/pages/AuthCallback.tsx =====
// Maneja el callback OAuth de Google.
//
// Google redirige a: /auth/callback?code=xxx
// Con hash router, parseHash() lo convierte a: /#/auth/callback?code=xxx
//
// Tuve problemas con getSession() que devuelve sesión de un login anterior
// y el code de Google se pierde. Por eso usamos window.location.search
// DIRECTAMENTE para leer el code antes de que el hash router lo modifique.

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
        // ── 1. Leer code de Google DIRECTAMENTE del query string ──
        // Usamos el search original, NO el hash (porque parseHash() lo modifica)
        const originalSearch = window.location.search; // "?code=xxx"
        const code = new URLSearchParams(originalSearch).get('code');
        const hashQuery = new URLSearchParams((window.location.hash.split('?')[1] || ''));
        const hashCode = hashQuery.get('code');

        const finalCode = code || hashCode;

        console.log('[AuthCallback] URL:', window.location.href);
        console.log('[AuthCallback] search:', originalSearch);
        console.log('[AuthCallback] hash:', window.location.hash);
        console.log('[AuthCallback] code from search:', code);
        console.log('[AuthCallback] code from hash:', hashCode);
        console.log('[AuthCallback] final code:', finalCode ? 'PRESENTE' : 'AUSENTE');

        // ── 2. Intercambiar code por sesión ──
        if (finalCode) {
          console.log('[AuthCallback] Intercambiando code por sesión...');
          const { error } = await supabase.auth.exchangeCodeForSession(finalCode);
          if (error) {
            console.error('[AuthCallback] exchangeCodeForSession error:', error);
            throw new Error(error.message);
          }
          console.log('[AuthCallback] Code intercambiado exitosamente');
        } else {
          console.log('[AuthCallback] Sin code. Verificando sesión existente...');
        }

        // ── 3. Obtener sesión ──
        await new Promise(r => setTimeout(r, 800));
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          throw new Error(sessionError?.message || 'No se pudo obtener la sesión');
        }

        console.log('[AuthCallback] Sesión:', session.user.email);
        const accessToken = session.access_token;

        // ── 4. Buscar perfil ──
        let profile;
        try {
          const { data: res } = await auth.me();
          profile = res.data;
          console.log('[AuthCallback] Perfil encontrado:', profile.name);
        } catch (meErr: any) {
          console.log('[AuthCallback] Perfil no encontrado en DB. Buscando por authId...');

          // El usuario existe en Supabase Auth pero quizás no en nuestra tabla users
          // Intentar crear el registro manualmente
          const names = (session.user.user_metadata?.full_name || session.user.email || '').split(' ');
          const email = session.user.email!;

          try {
            // Llamar register que crea en Auth + Users
            const regBody = {
              name: names[0] || email.split('@')[0],
              lastName: names.slice(1).join(' ') || '',
              email: email,
              phone: session.user.phone || session.user.user_metadata?.phone || '0000000000',
              password: crypto.randomUUID(),
              documentType: 'cedula',
              documentId: '0000000000',
              birthDate: '',
            };

            console.log('[AuthCallback] Intentando register:', regBody.email);
            const regRes = await auth.register(regBody);
            profile = regRes.data.user;
            console.log('[AuthCallback] Perfil creado:', profile.name);
          } catch (regErr: any) {
            // Si falla porque el usuario ya existe en Auth (caso real),
            // intentar obtener el perfil llamando a /me con el token actual
            console.log('[AuthCallback] Register falló:', regErr?.response?.data?.error);

            if (regErr?.response?.data?.error?.includes?.('already been registered')) {
              // El usuario ya existe en Auth — probar a buscarlo en users por email
              console.log('[AuthCallback] Usuario ya existe en Auth. Buscando perfil por email...');
              try {
                const { data: meRes } = await auth.me();
                profile = meRes.data;
                console.log('[AuthCallback] Perfil recuperado:', profile.name);
              } catch {
                // El usuario no tiene registro en nuestra tabla — no podemos continuar
                throw new Error(
                  'Tu cuenta de Google ya está registrada en nuestro sistema pero ' +
                  'no tiene un perfil completo. Por favor, inicia sesión con email y contraseña.'
                );
              }
            } else {
              throw new Error(regErr?.response?.data?.error || 'Error al crear perfil de usuario');
            }
          }
        }

        setUser(profile);
        toast.success(`¡Bienvenido, ${profile.name}!`);

        // ── 5. Redirigir ──
        window.location.hash = '#/dashboard';
        navigate('/dashboard');

      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        toast.error(err?.response?.data?.error || err?.message || 'Error al iniciar sesión con Google');
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
