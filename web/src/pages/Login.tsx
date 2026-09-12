// ===== web/src/pages/Login.tsx =====
import { useState } from 'react';
import { useNavigate, useParams, Link } from '@/lib/router-exports';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { guardarSesion } from '@/lib/session';
import GoogleButton from '@/components/GoogleButton';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: res } = await auth.login({ email: form.email, password: form.password });
      guardarSesion(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.user);

      toast.success(`Bienvenido, ${res.data.user.name}!`);
      navigate('/dashboard');
    } catch (err: any) {
      // El servidor ya devuelve un mensaje claro y en español.
      toast.error(err.response?.data?.error ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const entrarConGoogle = async (idToken: string) => {
    setLoading(true);
    try {
      const { data: res } = await auth.google(idToken);
      guardarSesion(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.user);
      toast.success(`Bienvenido, ${res.data.user.name}!`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'No se pudo entrar con Google');
    } finally {
      setLoading(false);
    }
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

            <div className="mt-6 flex justify-center">
              <GoogleButton onToken={entrarConGoogle} texto="signin_with" disabled={loading} />
            </div>
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
