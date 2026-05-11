// ===== web/src/pages/Register.tsx =====
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
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
      // 1. Backend creates Supabase Auth user + our DB row
      const { data: regRes } = await auth.register(form);
      if (!regRes.data?.user) throw new Error('Registration failed');

      // 2. Sign in immediately to get the session token
      const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (sbErr || !sbData.session) throw new Error(sbErr?.message ?? 'Auto-login failed');

      // 3. Fetch full profile
      const { data: meRes } = await auth.me();
      setUser(meRes.data);

      toast.success('¡Cuenta creada! Verifica tu identidad para publicar vehículos.');
      navigate('/profile');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? err.message ?? 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div key={key}>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <input
        type={type} required value={(form as any)[key]} placeholder={placeholder}
        onChange={e => set(key, e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-white mb-2">
            <Car className="text-cyan-400" size={28} />
            Omni<span className="text-cyan-400">Drive</span>
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
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
            >
              <option value="cedula">Cédula de identidad</option>
              <option value="pasaporte">Pasaporte</option>
            </select>
          </div>
          {field('Número de documento', 'documentId', 'text', '1712345678')}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}

