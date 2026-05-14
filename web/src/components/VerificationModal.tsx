import { useState } from 'react';
import { X, Shield, CheckCircle, AlertTriangle, Loader2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth as authApi } from '@/lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (data: any) => void;
}

interface VerificationStep {
  id: 'intro' | 'cedula' | 'verifying' | 'result' | 'verified';
}

export default function VerificationModal({ isOpen, onClose, onVerified }: Props) {
  const [step, setStep] = useState<VerificationStep['id']>('intro');
  const [cedula, setCedula] = useState('');
  const [result, setResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleVerify = async () => {
    const clean = cedula.replace(/\s/g, '');
    if (!/^\d{10}$/.test(clean)) {
      setError('Ingresa un número de cédula válido de 10 dígitos');
      return;
    }
    setError('');
    setVerifying(true);
    setStep('verifying');

    try {
      const { data: res } = await authApi.verificarCedula(clean);
      if (res.error) {
        setError(res.error);
        setResult(res.data?.result ?? null);
        setStep('result');
        return;
      }
      setResult(res.data);
      setStep('verified');
      toast.success('✅ Identidad verificada exitosamente');
      onVerified(res.data);
      setTimeout(onClose, 2000);
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Error al verificar la cédula';
      setError(msg);
      setResult(e.response?.data?.data?.result ?? null);
      setStep('result');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-600 hover:text-white z-10 transition-colors">
          <X size={20} />
        </button>

        {/* INTRO */}
        {step === 'intro' && (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center mx-auto">
              <Shield size={32} className="text-indigo-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Verifica tu identidad</h2>
              <p className="text-sm text-slate-400">
                Para publicar vehículos y hacer reservas necesitas verificar tu identidad.
                La verificación es contra el Registro Civil del Ecuador.
              </p>
            </div>

            <div className="bg-slate-800 rounded-2xl p-5 space-y-3 text-left">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <UserCheck size={16} className="text-green-400" />
                ¿Qué necesitas?
              </h3>
              <ul className="space-y-2">
                {[
                  'Tu número de cédula',
                  'La cédula debe estar activa en el Registro Civil',
                  'Solo toma 5 segundos',
                  'Tus datos están protegidos',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <CheckCircle size={12} className="text-green-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button onClick={() => setStep('cedula')}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors text-sm">
              Comenzar verificación
            </button>
            <p className="text-xs text-slate-600">La verificación tiene un costo de $0.05 por consulta contra el Registro Civil</p>
          </div>
        )}

        {/* CEDULA INPUT */}
        {step === 'cedula' && (
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Ingresa tu cédula</h2>
              <p className="text-sm text-slate-400">Tu número de cédula será consultado contra el Registro Civil para verificar tu identidad.</p>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2 font-medium">Número de cédula</label>
              <input
                value={cedula}
                onChange={e => { setCedula(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                placeholder="10 dígitos sin guiones"
                maxLength={10}
                inputMode="numeric"
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg text-white text-center tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 placeholder:text-sm placeholder:tracking-normal"
              />
              {error && (
                <p className="flex items-center gap-1.5 text-xs text-red-400 mt-2">
                  <AlertTriangle size={12} /> {error}
                </p>
              )}
            </div>

            <button onClick={handleVerify} disabled={cedula.length !== 10 || verifying}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors text-sm">
              {verifying ? 'Verificando...' : 'Verificar identidad'}
            </button>

            <button onClick={() => setStep('intro')} className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors">
              ← Atrás
            </button>
          </div>
        )}

        {/* VERIFYING */}
        {step === 'verifying' && (
          <div className="p-8 text-center space-y-5">
            <Loader2 size={40} className="animate-spin text-indigo-400 mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold text-white">Verificando tu identidad</p>
              <p className="text-sm text-slate-400">Consultando {cedula} contra el Registro Civil...</p>
            </div>
          </div>
        )}

        {/* RESULT — when identity IS verified (success) */}
        {step === 'verified' && result && (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle size={34} className="text-green-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">✅ Identidad verificada</h2>
              <p className="text-sm text-slate-400">Tu cédula ha sido verificada exitosamente contra el Registro Civil.</p>
            </div>

            <div className="bg-slate-800 rounded-2xl p-4 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Nombres</span>
                <span className="text-white font-medium">{result.verification?.nombres || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Apellidos</span>
                <span className="text-white font-medium">{result.verification?.apellidos || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Estado</span>
                <span className="text-green-400 font-medium">{result.verification?.estado}</span>
              </div>
            </div>
          </div>
        )}

        {/* RESULT — cuando falla */}
        {step === 'result' && !result?.verification?.nombres && (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle size={34} className="text-red-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Verificación fallida</h2>
              <p className="text-sm text-slate-400">{error || 'No se pudo verificar tu identidad. Intenta de nuevo.'}</p>
            </div>

            {result?.raw && (
              <div className="bg-slate-800 rounded-2xl p-4 text-left text-xs text-slate-500 font-mono overflow-auto max-h-32">
                {JSON.stringify(result.raw, null, 2)}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep('cedula'); setError(''); }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors text-sm">
                Intentar de nuevo
              </button>
              <button onClick={onClose}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors text-sm text-slate-400">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="px-8 pb-5">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
            <Shield size={10} />
            <span>Datos consultados contra DIGERCIC vía WebServices.ec</span>
          </div>
        </div>
      </div>
    </div>
  );
}
