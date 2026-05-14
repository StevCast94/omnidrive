// ===== web/src/ pages/Login.tsx =====
import { useState } from 'react';
import { useNavigate, useParams, Link } from '@/lib/router-exports';
import { Car } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (sbErr || !sbData.session) throw new Error(sbErr?.message ?? 'Login failed');

      const { data: res } = await auth.me();
      setUser(res.data);

      toast.success(`Bienvenido, ${res.data.name}!`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setLoading(true);

    // ── ESTRATEGIA: OAuth con popup ──
    // En lugar de redirect (que causa problemas con hash routing),
    // usamos una ventana emergente para el OAuth.
    //
    // Cuando la ventana se cierra, onAuthStateChange detecta la sesión
    // y llamamos a /me para obtener el perfil.
    //
    // Esto evita COMPLETAMENTE el problema de Google redirigiendo
    // a nuestra app con hash routing.

    // Obtener la URL de autorización
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // La ventana popup se abre en Supabase, que redirige a Google
        // Cuando Google completa, Supabase redirige la popup a su propia
        // URL de callback interna, y el SDK de Supabase en la ventana
        // padre detecta el cambio via postMessage.
        //
        // No necesitamos redirectTo porque la popup se comunica por postMessage.
        redirectTo: window.location.origin + '/auth/callback',
      },
    }).then(({ data, error }) => {
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      
      if (data?.url) {
        // Abrir popup con la URL de autorización
        const width = 600;
        const height = 700;
        const left = Math.max(0, Math.round((screen.width - width) / 2));
        const top = Math.max(0, Math.round((screen.height - height) / 2));
        
        const popup = window.open(
          data.url,
          'google-oauth',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        if (!popup) {
          // Popup bloqueada — fallback a redirect normal
          toast.error('Popup bloqueada. Redirigiendo...');
          window.location.href = data.url;
          return;
        }

        // Timer para verificar si el popup se cerró
        const checkPopup = setInterval(async () => {
          if (popup.closed) {
            clearInterval(checkPopup);
            console.log('[Google Login] Popup cerrada. Verificando sesión...');

            // Verificar si la sesión se estableció
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              console.log('[Google Login] Sesión encontrada:', session.user.email);
              try {
                const { data: res } = await auth.me();
                setUser(res.data);
                toast.success(`Bienvenido, ${res.data.name}!`);
                navigate('/dashboard');
              } catch {
                // Nuevo usuario — crear perfil
                const names = (session.user.user_metadata?.full_name || session.user.email || '').split(' ');
                try {
                  await auth.register({
                    name: names[0] || session.user.email!.split('@')[0],
                    lastName: names.slice(1).join(' ') || '',
                    email: session.user.email!,
                    phone: session.user.phone || '0000000000',
                    password: crypto.randomUUID(),
                    documentType: 'cedula',
                    documentId: '0000000000',
                    birthDate: '',
                  });
                  const { data: meRes } = await auth.me();
                  setUser(meRes.data);
                  toast.success(`¡Bienvenido, ${meRes.data.name}!`);
                  navigate('/dashboard');
                } catch (regErr: any) {
                  toast.error(regErr?.response?.data?.error || 'Error al crear perfil');
                }
              }
            } else {
              toast.error('No se pudo iniciar sesión con Google');
            }
            setLoading(false);
          }
        }, 500);

        // Timeout de 2 minutos
        setTimeout(() => {
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setLoading(false);
        }, 120000);
      } else {
        toast.error('No se pudo generar la URL de autenticación');
        setLoading(false);
      }
    }).catch((err) => {
      toast.error(err.message || 'Error al iniciar con Google');
      setLoading(false);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-white mb-2">
            <Car className="text-cyan-400" size={28} />
            Omni<span className="text-cyan-400">Drive</span>
          </div>
          <p className="text-slate-400 text-sm">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 rounded-2xl p-8 border border-slate-800 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input
              type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
            <input
              type="password" required value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-3 text-slate-500">O continúa con</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 bg-white hover:bg-gray-100 disabled:opacity-50 text-slate-900 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-cyan-400 hover:text-cyan-300">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
