// ===== web/src/pages/AuthCallback.tsx =====
// Maneja el callback OAuth de Google de forma ultra-robusta.
//
// La URL de llegada puede ser:
//   /auth/callback?code=xxx             (sin hash — Vercel sirve index.html)
//   /#/auth/callback?code=xxx           (con hash router — navegación interna)
//   /#/auth/callback#access_token=xxx   (implicit flow — raro pero posible)
//
// Parseamos parámetros de TODAS las fuentes y usamos Supabase para intercambiar.

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
        // ── 1. Extraer parámetros OAuth de DONDE SEA ──
        // La URL real completa se ve así en cada caso:
        //   a) https://dominio/auth/callback?code=xxx
        //   b) https://dominio/#/auth/callback?code=xxx
        //   c) https://dominio/#/auth/callback#access_token=xxx (imposible, el navegador trunca el segundo hash)
        //
        // Leer de:
        //   - window.location.search (query string real)
        //   - window.location.hash (query params dentro del hash)
        //   - fragmento después de # dentro del hash

        const searchParams = new URLSearchParams(window.location.search);
        const hashRaw = window.location.hash; // ej: "#/auth/callback?code=xxx"

        let code = searchParams.get('code');
        let accessToken = searchParams.get('access_token');

        // Si no hay code en search, buscar en el hash
        if (!code && hashRaw.includes('?')) {
          const hashQuery = new URLSearchParams(hashRaw.split('?')[1]);
          code = hashQuery.get('code');
          accessToken = hashQuery.get('access_token');
        }

        console.log('[AuthCallback] URL:', window.location.href);
        console.log('[AuthCallback] code:', code ? 'presente' : 'ausente');
        console.log('[AuthCallback] accessToken:', accessToken ? 'presente' : 'ausente');

        // ── 2. Intercambiar code por sesión ──
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw new Error(error.message);
        } else if (accessToken) {
          const refreshToken = (hashRaw.includes('?') ? new URLSearchParams(hashRaw.split('?')[1]).get('refresh_token') : null) || '';
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        } else {
          // Sin params — quizás Supabase ya procesó automáticamente
          // o el usuario llegó aquí por navegación manual
          console.log('[AuthCallback] Sin parámetros OAuth, verificando sesión existente...');
        }

        // ── 3. Esperar sesión ──
        await new Promise(r => setTimeout(r, 800));

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          throw new Error(sessionError?.message || 'No se pudo obtener la sesión');
        }

        console.log('[AuthCallback] Sesión obtenida:', session.user.email);

        // ── 4. Buscar o crear perfil ──
        let profile;
        try {
          const { data: res } = await auth.me();
          profile = res.data;
          console.log('[AuthCallback] Perfil existente:', profile.name);
        } catch (meErr: any) {
          console.log('[AuthCallback] Perfil no encontrado, creando...');
          // Nuevo usuario — crear perfil
          const names = (session.user.user_metadata?.full_name || '').split(' ');
          try {
            const regData = {
              name: names[0] || 'Usuario',
              lastName: names.slice(1).join(' ') || '',
              email: session.user.email!,
              phone: session.user.phone || session.user.user_metadata?.phone || '0000000000',
              password: crypto.randomUUID(),
              documentType: 'cedula',
              documentId: '0000000000',
              birthDate: '',
            };
            console.log('[AuthCallback] Registrando:', regData.email);
            await auth.register(regData);
            const { data: res } = await auth.me();
            profile = res.data;
            console.log('[AuthCallback] Perfil creado:', profile.name);
          } catch (regErr: any) {
            console.error('[AuthCallback] Error al crear perfil:', regErr?.response?.data || regErr.message);
            throw new Error('No se pudo crear tu perfil de usuario');
          }
        }

        setUser(profile);
        toast.success(`¡Bienvenido, ${profile.name}!`);

        // ── 5. Redirigir ──
        history.replaceState(null, '', '#/dashboard');
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
