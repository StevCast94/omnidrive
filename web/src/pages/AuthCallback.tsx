// ===== web/src/pages/AuthCallback.tsx =====
import { useEffect } from 'react';
import { useNavigate } from '@/lib/router-exports';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      // The OAuth provider redirects to /auth/callback?code=xxx
      // With hash routing, the URL is actually /#/auth/callback?code=xxx
      // Parse the full URL hash + search params
      const hash = window.location.hash; // "#/auth/callback?code=xxx"
      const search = hash.includes('?') ? hash.split('?')[1] : window.location.search.substring(1);
      
      if (search) {
        // Let Supabase handle the OAuth code exchange
        const { error } = await supabase.auth.exchangeCodeForSession(
          Object.fromEntries(new URLSearchParams(search))
        );
        if (error) {
          toast.error('Error al procesar autenticación');
          navigate('/login');
          return;
        }
      }

      // Now get the session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        toast.error('Error al autenticar con Google');
        navigate('/login');
        return;
      }

      try {
        const { data: res } = await auth.me();
        setUser(res.data);
        toast.success(`Bienvenido, ${res.data.name}!`);
        navigate('/dashboard');
      } catch {
        // New user from OAuth — no profile exists yet
        // Create one via the backend
        try {
          const { data: regRes } = await auth.register({
            name: session.user.user_metadata?.full_name?.split(' ')[0] || 'Usuario',
            lastName: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
            email: session.user.email!,
            phone: session.user.phone || '',
            password: crypto.randomUUID(), // random password since they use Google
            documentType: 'cedula',
            documentId: '0000000000',
            birthDate: '',
          });
          const { data: meRes } = await auth.me();
          setUser(meRes.data);
          toast.success(`¡Bienvenido, ${meRes.data.name}!`);
          navigate('/dashboard');
        } catch (err: any) {
          toast.error(err.message ?? 'Error al crear perfil');
          navigate('/login');
        }
      }
    };
    handleCallback();
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
