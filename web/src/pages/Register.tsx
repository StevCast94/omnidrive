import { useState } from 'react';
import { useNavigate, useParams, Link } from '@/lib/router-exports';
import { Car } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PhoneInput } from '@/components/PhoneInput';

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [form, setForm] = useState({
    name: '', lastName: '', email: '', phone: '',
    password: '', documentType: 'cedula', documentId: '', birthDate: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/auth/callback',
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message ?? 'Error al iniciar con Google');
      setLoading(false);
    }
  };

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

  // Helper to detect if birthDate is a full ISO date vs just a partial
  const birthValue = form.birthDate || '';
  const displayBirth = (() => {
    if (!birthValue) return { year: '', month: '', day: '' };
    const d = new Date(birthValue);
    if (isNaN(d.getTime())) return { year: '', month: '', day: '' };
    return {
      year: d.getFullYear().toString(),
      month: (d.getMonth() + 1).toString().padStart(2, '0'),
      day: d.getDate().toString().padStart(2, '0'),
    };
  })();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  // Días por mes según año y mes
  const selectedYear = parseInt(displayBirth.year) || 0;
  const selectedMonth = parseInt(displayBirth.month) || 0;
  const daysInMonth = selectedYear && selectedMonth
    ? new Date(selectedYear, selectedMonth, 0).getDate()
    : 31;

  // Si el día actual excede los días del mes, lo reseteamos
  const currentDay = parseInt(displayBirth.day) || 0;
  const validDay = currentDay > daysInMonth ? '' : displayBirth.day;

  const setBirthDate = (year: string, month: string, day: string) => {
    // Auto-reset day if it exceeds the new month's days
    const y = parseInt(year) || 0;
    const m = parseInt(month) || 0;
    const maxDays = y && m ? new Date(y, m, 0).getDate() : 31;
    const d = parseInt(day) || 0;
    const finalDay = d > maxDays ? '' : day;

    if (year && month && finalDay) {
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(finalDay));
      if (!isNaN(date.getTime())) {
        set('birthDate', date.toISOString().split('T')[0]);
      }
    } else {
      set('birthDate', '');
    }
  };

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

          <PhoneInput
            value={form.phone}
            onChange={v => set('phone', v)}
            placeholder="99 000 0000"
            required
          />

          {field('Contraseña', 'password', 'password', '••••••••')}

          {/* Fecha de nacimiento - 3 selects estilo Red Dental */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Fecha de nacimiento <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* ║ AÑO ║ MES ║ DÍA — orden importa para validación */}
              <select
                value={displayBirth.year}
                onChange={e => setBirthDate(e.target.value, displayBirth.month, displayBirth.day)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 appearance-none"
              >
                <option value="">Año</option>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={displayBirth.month}
                onChange={e => setBirthDate(displayBirth.year, e.target.value, validDay)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 appearance-none"
              >
                <option value="">Mes</option>
                {[
                  { v: '01', l: 'Enero' }, { v: '02', l: 'Febrero' }, { v: '03', l: 'Marzo' },
                  { v: '04', l: 'Abril' }, { v: '05', l: 'Mayo' }, { v: '06', l: 'Junio' },
                  { v: '07', l: 'Julio' }, { v: '08', l: 'Agosto' }, { v: '09', l: 'Septiembre' },
                  { v: '10', l: 'Octubre' }, { v: '11', l: 'Noviembre' }, { v: '12', l: 'Diciembre' },
                ].map(m => (
                  <option key={m.v} value={m.v}>{m.l}</option>
                ))}
              </select>
              <select
                value={validDay}
                onChange={e => setBirthDate(displayBirth.year, displayBirth.month, e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 appearance-none"
              >
                <option value="">Día</option>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d.toString().padStart(2, '0')}>{d}</option>
                ))}
              </select>
            </div>
          </div>

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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-3 text-slate-500">O regístrate con</span>
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
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
