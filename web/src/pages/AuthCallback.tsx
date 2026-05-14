// ===== web/src/pages/AuthCallback.tsx =====
// Callback OAuth de Google. 
//
// El code de Google puede llegar de varias formas:
//   1. Como ?code=xxx en la URL original (PKCE flow)
//   2. En el hash después de que Supabase lo procese automáticamente
//   3. Como #access_token=xxx (implicit flow)
//
// Log de lo que recibió la última vez:
//   URL: https://omnidrive.vercel.app/auth/callback#auth/callback
//   search: vacío
//   hash: #auth/callback
//   code: ausente  
//
// Problema: Google NO está pasando ningún parámetro.
// Causa probable: la URL de redirect no coincide exactamente con 
// la registrada en Supabase, o Google rechazó la autenticación.

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
        // ── 1. LOG COMPLETO de la URL de llegada ──
        const fullUrl = window.location.href;
        const searchStr = window.location.search;
        const hashStr = window.location.hash;
        const urlParams = new URLSearchParams(searchStr);
        const hashParams = new URLSearchParams(hashStr.includes('?') ? hashStr.split('?')[1] : '');
        const hashFragmentParams = hashStr.startsWith('#/') ? {} : Object.fromEntries(new URLSearchParams(hashStr.replace(/^#/, '')));

        console.log('══════ AuthCallback Debug ══════');
        console.log('full URL:', fullUrl);
        console.log('search:', searchStr);
        console.log('hash:', hashStr);
        console.log('search params (code):', urlParams.get('code'));
        console.log('search params (error):', urlParams.get('error'));
        console.log('search params (error_description):', urlParams.get('error_description'));
        console.log('hash params (code):', hashParams.get('code'));
        console.log('hash params (access_token):', hashParams.get('access_token'));
        console.log('hash params (error):', hashParams.get('error'));
        console.log('hash fragment params:', hashFragmentParams);
        console.log('═══════════════════════════════');

        const errorFromGoogle = urlParams.get('error') || hashParams.get('error') || hashFragmentParams.error;
        const errorDesc = urlParams.get('error_description') || hashParams.get('error_description') || hashFragmentParams.error_description;

        if (errorFromGoogle) {
          throw new Error(`Google OAuth error: ${errorFromGoogle} — ${errorDesc || ''}`);
        }

        // ── 2. Leer code de donde sea ──
        const code = urlParams.get('code') || hashParams.get('code');
        const accessToken = urlParams.get('access_token') || hashParams.get('access_token') || hashFragmentParams.access_token;
        const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token') || hashFragmentParams.refresh_token;

        if (code) {
          console.log('[AuthCallback] Intercambiando code por sesión...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw new Error('exchangeCodeForSession: ' + error.message);
          console.log('[AuthCallback] Code intercambiado OK');
        } else if (accessToken) {
          console.log('[AuthCallback] Restaurando sesión desde access_token...');
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' });
        } else {
          // Sin parámetros — probar si Supabase ya procesó la sesión
          console.log('[AuthCallback] Sin parámetros OAuth. Probando getSession...');

          // Verificar si el SDK de Supabase ya detectó tokens en el hash
          // El SDK escucha hashchange y procesa automáticamente
          await new Promise(r => setTimeout(r, 1500));
        }

        // ── 3. Obtener sesión ──
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          console.error('[AuthCallback] getSession falló:', sessionError?.message);
          throw new Error('No se pudo obtener la sesión');
        }

        console.log('[AuthCallback] Sesión OK:', session.user.email);
        const accessToken2 = session.access_token;

        // ── 4. Buscar o crear perfil ──
        let profile;
        try {
          const { data: res } = await auth.me();
          profile = res.data;
        } catch {
          console.log('[AuthCallback] Sin perfil. Creando...');
          const names = (session.user.user_metadata?.full_name || session.user.email || '').split(' ');
          const email = session.user.email!;

          try {
            const { data: regRes } = await auth.register({
              name: names[0] || email.split('@')[0],
              lastName: names.slice(1).join(' ') || '',
              email,
              phone: session.user.phone || session.user.user_metadata?.phone || '0000000000',
              password: crypto.randomUUID(),
              documentType: 'cedula',
              documentId: '0000000000',
              birthDate: '',
            });
            profile = regRes.data.user;
          } catch (regErr: any) {
            const msg = regErr?.response?.data?.error || '';
            if (msg.includes('already been registered')) {
              console.log('[AuthCallback] Usuario ya existe en Auth. Re-intentando me()...');
              // Esperar y reintentar — quizás la sesión se propagó
              await new Promise(r => setTimeout(r, 1000));
              const { data: retryRes } = await auth.me();
              profile = retryRes.data;
            } else {
              throw new Error(msg || 'Error al crear perfil');
            }
          }
        }

        if (!profile) throw new Error('No se pudo obtener o crear el perfil');

        setUser(profile);
        toast.success(`¡Bienvenido, ${profile.name}!`);

        // ── 5. Redirigir limpiamente ──
        history.replaceState(null, '', '#/dashboard');
        navigate('/dashboard');

      } catch (err: any) {
        console.error('[AuthCallback] Error completo:', err);
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
