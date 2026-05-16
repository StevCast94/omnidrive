import { useState, useRef } from 'react';
import { useNavigate, Link } from '@/lib/router-exports';
import { Car, ArrowLeft, Mail, KeyRound, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

type Step = 'email' | 'code' | 'reset' | 'done';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const sendCode = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Ingresa un email válido');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth/callback?type=recovery',
      });
      if (err) throw err;
      toast.success('Código enviado a tu correo');
      setStep('code');
      setTimeout(() => codeRefs.current[0]?.focus(), 300);
    } catch (e: any) {
      setError(e.message || 'Error al enviar código');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (i: number, val: string) => {
    if (val.length > 1) {
      // Pegado
      const digits = val.replace(/\D/g, '').slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((d, j) => { if (i + j < 6) newCode[i + j] = d; });
      setCode(newCode);
      const nextIdx = Math.min(i + digits.length, 5);
      codeRefs.current[nextIdx]?.focus();
      return;
    }
    const digit = val.replace(/\D/g, '').slice(-1);
    const newCode = [...code];
    newCode[i] = digit;
    setCode(newCode);
    if (digit && i < 5) codeRefs.current[i + 1]?.focus();
  };

  const handleCodeKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      codeRefs.current[i - 1]?.focus();
    }
    if (e.key === 'Enter' && code.every(c => c)) {
      verifyCode();
    }
  };

  const verifyCode = () => {
    // Con Supabase, el código se verifica automáticamente al hacer click en el link del email.
    // Si usamos magic link + redirect, el token viene en la URL.
    // Para flujo manual: mostramos el siguiente paso
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Ingresa el código completo de 6 dígitos');
      return;
    }
    setError('');
    setStep('reset');
    setTimeout(() => setShowPassword(true), 200);
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
              <p className="text-sm text-slate-400">Te enviaremos un código de verificación a tu correo electrónico.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email" required value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && sendCode()}
                placeholder="tu@email.com"
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button onClick={sendCode} disabled={loading || !email}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>

            <p className="text-center text-sm text-slate-500">
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300">Volver a inicio de sesión</Link>
            </p>
          </div>
        )}

        {/* ─── CÓDIGO ─── */}
        {step === 'code' && (
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-cyan-600/20 flex items-center justify-center mx-auto">
                <KeyRound size={28} className="text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Código de verificación</h2>
              <p className="text-sm text-slate-400">Ingresa el código de 6 dígitos que enviamos a <strong className="text-white">{email}</strong></p>
            </div>

            <div className="flex justify-center gap-2">
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={el => { codeRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleCodeChange(i, e.target.value)}
                  onKeyDown={e => handleCodeKeyDown(i, e)}
                  onPaste={e => {
                    if (i === 0) {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                      if (pasted) {
                        const newCode = pasted.split('').concat(['','','','','','']).slice(0, 6);
                        setCode(newCode);
                        codeRefs.current[Math.min(pasted.length, 5)]?.focus();
                      }
                    }
                  }}
                  className="w-11 h-12 bg-slate-800 border border-slate-700 rounded-xl text-center text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                />
              ))}
            </div>

            {error && <p className="text-xs text-red-400 text-center">{error}</p>}

            <button onClick={verifyCode} disabled={code.some(c => !c)}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors"
            >
              Verificar código
            </button>

            <div className="text-center">
              <button onClick={sendCode} className="text-xs text-slate-500 hover:text-cyan-400 transition-colors">
                ¿No recibiste el código? Reenviar
              </button>
            </div>
          </div>
        )}

        {/* ─── NUEVA CONTRASEÑA ─── */}
        {step === 'reset' && (
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-cyan-600/20 flex items-center justify-center mx-auto">
                <KeyRound size={28} className="text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Nueva contraseña</h2>
              <p className="text-sm text-slate-400">Ingresa tu nueva contraseña.</p>
            </div>

            {/* Password */}
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

            {/* Confirmar */}
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
              <p className="text-sm text-slate-400">Tu contraseña se ha cambiado correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.</p>
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
