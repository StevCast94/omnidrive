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
      // Supabase automatically processes the OAuth redirect
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        toast.error('Error al autenticar con Google');
        navigate('/login');
        return;
      }

      try {
        // Try to get existing profile, or create one
        const { data: res } = await auth.me();
        setUser(res.data);
        toast.success(`Bienvenido, ${res.data.name}!`);
        navigate('/dashboard');
      } catch {
        // New user — redirect to complete registration
        navigate('/register?oauth=true');
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
