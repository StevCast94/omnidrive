import { useState, useEffect } from 'react';
import { useNavigate, Link } from '@/lib/router-exports';
import { Car, ArrowLeft, Mail, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';

type Step = 'email' | 'sent' | 'reset' | 'done';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Si el usuario viene de un recovery link con token, mostrar reset
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || window.location.search);
    const type = params.get('type');
    if (type === 'recovery') {
      setStep('reset');
    }
  }, []);

  // Si ya hay sesión, redirigir
  useEffect(() => {
    if (user) {
      // Si el usuario ya está logueado y quiere cambiar contraseña
      const hashSearch = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
      if (hashSearch.get('type') === 'recovery') {
        setStep('reset');
      } else {
        navigate('/');
      }
    }
  }, [user]);

  const sendRecovery = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Ingresa un email válido');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/#/forgot-password?type=recovery',
      });
      if (err) throw err;
      setStep('sent');
      toast.success('Revisa tu correo');
    } catch (e: any) {
      setError(e.message || 'Error al enviar el correo');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setStep('done');
      toast.success('Contraseña actualizada correctamente');
    } catch (e: any) {
      setError(e.message || 'Error al actualizar contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-slate-500 hover:text-white mb-4 transition-colors text-sm">
          <ArrowLeft size={16} /> Volver al inicio
        </button>
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-2xl font-bold text-white mb-2 cursor-pointer hover:opacity-80 transition-opacity">
            <Car className="text-cyan-400" size={28} />
            Omni<span className="text-cyan-400">Drive</span>
          </button>
          <p className="text-slate-400 text-sm">Recupera tu contraseña</p>
        </div>

        {/* ─── EMAIL ─── */}
        {step === 'email' && (
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-cyan-600/20 flex items-center justify-center mx-auto">
                <Mail size={28} className="text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-white">¿Olvidaste tu contraseña?</h2>
              <p className="text-sm text-slate-400">Te enviaremos un enlace para restablecer tu contraseña.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email" required value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && sendRecovery()}
                placeholder="tu@email.com"
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button onClick={sendRecovery} disabled={loading || !email}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>

            <p className="text-center text-sm text-slate-500">
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300">Volver a inicio de sesión</Link>
            </p>
          </div>
        )}

        {/* ─── ENVIADO ─── */}
        {step === 'sent' && (
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-cyan-600/20 flex items-center justify-center mx-auto">
              <Mail size={32} className="text-cyan-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Revisa tu correo</h2>
              <p className="text-sm text-slate-400">
                Hemos enviado un enlace de restauración a <strong className="text-white">{email}</strong>.
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Haz clic en el enlace del correo y serás redirigido para crear una nueva contraseña.
              </p>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-left">
              <p className="text-xs text-slate-400 font-medium">¿No recibiste el correo?</p>
              <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                <li>Revisa la carpeta de spam / correo no deseado</li>
                <li>Asegúrate de haber escrito el email correctamente</li>
                <li>Si usas Gmail, revisa la pestaña "Promociones"</li>
              </ul>
            </div>

            <button onClick={sendRecovery} disabled={loading}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium text-sm transition-colors"
            >
              {loading ? 'Enviando...' : 'Reenviar enlace'}
            </button>

            <p className="text-center text-sm text-slate-500">
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300">Volver a inicio de sesión</Link>
            </p>
          </div>
        )}

        {/* ─── NUEVA CONTRASEÑA ─── */}
        {step === 'reset' && (
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-cyan-600/20 flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Nueva contraseña</h2>
              <p className="text-sm text-slate-400">Tu identidad ha sido verificada. Ingresa tu nueva contraseña.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} required value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Mín. 8 caracteres"
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar contraseña</label>
              <input
                type={showPassword ? 'text' : 'password'} required value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Repite la contraseña"
                className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm ${
                  confirmPassword && password !== confirmPassword ? 'border-red-500'
                  : confirmPassword && password === confirmPassword ? 'border-green-500/50'
                  : 'border-slate-700'
                }`}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1.5">Las contraseñas no coinciden</p>
              )}
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button onClick={resetPassword} disabled={loading || !password || !confirmPassword}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </div>
        )}

        {/* ─── HECHO ─── */}
        {step === 'done' && (
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle size={34} className="text-green-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">¡Contraseña actualizada!</h2>
              <p className="text-sm text-slate-400">Tu contraseña se ha cambiado correctamente.</p>
            </div>
            <button onClick={() => navigate('/login')}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-semibold text-sm transition-colors"
            >
              Iniciar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
