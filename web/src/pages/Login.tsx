// ===== web/src/pages/Login.tsx =====
import { useState, useRef } from 'react';
import { useNavigate, useParams, Link } from '@/lib/router-exports';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/ui/Logo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const oauthInProgress = useRef(false);

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
    if (oauthInProgress.current) return;
    oauthInProgress.current = true;
    setLoading(true);

    // El redirect debe apuntar AL HASH para que el hash router de la app lo capture
    // Supabase mete el access_token despues del #, y la app espera #/auth/callback
    // Al poner origin + '/auth/callback' el browser interpreta /auth/callback#token
    // y el hash router nunca lo ve porque no hay #/ delante
    const redirectTo = window.location.origin + '/#' + '/auth/callback';

    console.log('[Google Login] redirectTo:', redirectTo);

    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    }).then(({ data, error }) => {
      if (error) {
        toast.error(error.message);
        setLoading(false);
        oauthInProgress.current = false;
        return;
      }

      if (data?.url) {
        console.log('[Google Login] URL:', data.url.substring(0, 100) + '...');
        window.location.href = data.url;
      } else {
        toast.error('No se pudo generar la URL de autenticación');
        setLoading(false);
        oauthInProgress.current = false;
      }
    }).catch((err) => {
      toast.error(err.message || 'Error al iniciar con Google');
      setLoading(false);
      oauthInProgress.current = false;
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="max-w-md w-full">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-slate-500 hover:text-white mb-4 transition-colors text-sm">
          <ArrowLeft size={16} /> Volver al inicio
        </button>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-8 rounded-2xl shadow-lg animate-slide-up">
          {/* Header */}
          <div className="text-center mb-8">
            <Logo variant="icon" className="mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white">Bienvenido de vuelta</h2>
            <p className="text-slate-400 mt-2 text-sm">Ingresa a tu cuenta de OmniDrive</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Correo electrónico"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              autoComplete="off"
            />
            <div className="relative">
              <Input
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center text-slate-400">
                <input type="checkbox" className="mr-2 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500" />
                Recordarme
              </label>
              <Link to="/forgot-password" className="text-cyan-400 hover:text-cyan-300 hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={loading}
            >
              Iniciar Sesión
            </Button>
          </form>

          {/* Divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-900 text-slate-500">O continúa con</span>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full mt-6"
              size="lg"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </Button>
          </div>
        </div>

        <div className="text-center text-sm mt-4">
          <p className="text-slate-500">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-cyan-400 hover:text-cyan-300 hover:underline">Regístrate</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
