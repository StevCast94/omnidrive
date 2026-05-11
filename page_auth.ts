// ===== web/src/pages/Login.tsx =====
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: res } = await auth.login(form);
      setAuth(res.data.user, res.data.token);
      toast.success(`Bienvenido, ${res.data.user.name}!`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-white mb-2">
            <Car className="text-indigo-400" size={28} />
            Omni<span className="text-indigo-400">Drive</span>
          </div>
          <p className="text-slate-400 text-sm">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 rounded-2xl p-8 border border-slate-800 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input
              type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
            <input
              type="password" required value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}


// ===== web/src/pages/Register.tsx =====
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({
    name: '', lastName: '', email: '', phone: '',
    password: '', documentType: 'cedula', documentId: '', birthDate: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: res } = await auth.register(form);
      setAuth(res.data.user, res.data.token);
      toast.success('¡Cuenta creada! Verifica tu identidad para publicar vehículos.');
      navigate('/profile');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <input
        type={type} required value={(form as any)[key]} placeholder={placeholder}
        onChange={e => set(key, e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-white mb-2">
            <Car className="text-indigo-400" size={28} />
            Omni<span className="text-indigo-400">Drive</span>
          </div>
          <p className="text-slate-400 text-sm">Crea tu cuenta gratis</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 rounded-2xl p-8 border border-slate-800 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {field('Nombre', 'name', 'text', 'Juan')}
            {field('Apellido', 'lastName', 'text', 'Pérez')}
          </div>
          {field('Email', 'email', 'email', 'tu@email.com')}
          {field('Teléfono', 'phone', 'tel', '+593 99 000 0000')}
          {field('Contraseña', 'password', 'password', '••••••••')}
          {field('Fecha de nacimiento', 'birthDate', 'date')}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo de documento</label>
            <select
              value={form.documentType} onChange={e => set('documentType', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="cedula">Cédula de identidad</option>
              <option value="pasaporte">Pasaporte</option>
            </select>
          </div>
          {field('Número de documento', 'documentId', 'text', '1712345678')}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
