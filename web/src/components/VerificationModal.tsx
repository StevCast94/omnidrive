import { useState, useEffect } from 'react';
import { X, Shield, CheckCircle, AlertTriangle, Loader2, UserCheck, Smartphone, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth as authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (data: any) => void;
}

type Step = 'intro' | 'cedula' | 'verifying-cedula' | 'cedula-verified' | 'whatsapp' | 'verifying-whatsapp' | 'result';

export default function VerificationModal({ isOpen, onClose, onVerified }: Props) {
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>('intro');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState(user?.phone?.replace(/^0+/, '') || '');
  const [cedulaResult, setCedulaResult] = useState<any>(null);
  const [whatsappResult, setWhatsappResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setStep('intro');
      setCedula('');
      setError('');
      setCedulaResult(null);
      setWhatsappResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerifyCedula = async () => {
    const clean = cedula.replace(/\s/g, '');
    if (!/^\d{10}$/.test(clean)) {
      setError('Ingresa un número de cédula válido de 10 dígitos');
      return;
    }
    setError('');
    setVerifying(true);
    setStep('verifying-cedula');

    try {
      const { data: res } = await authApi.verificarCedula(clean);
      if (res.error) {
        setError(res.error);
        setCedulaResult(res.data?.result ?? null);
        setStep('result');
        return;
      }
      setCedulaResult(res.data);
      toast.success('✅ Cédula verificada contra el Registro Civil');
      setStep('cedula-verified');
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Error al verificar la cédula';
      setError(msg);
      setCedulaResult(e.response?.data?.data?.result ?? null);
      setStep('result');
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyWhatsApp = async () => {
    const clean = phone.replace(/[^\d]/g, '');
    if (clean.length < 9) {
      setError('Ingresa un número de celular válido');
      return;
    }
    setError('');
    setVerifying(true);
    setStep('verifying-whatsapp');

    try {
      const { data: res } = await authApi.verificarWhatsApp(clean);
      if (res.error) {
        setWhatsappResult({ exists: false, whatsapp: false });
        setError(res.error);
        setStep('result');
        return;
      }
      setWhatsappResult(res.data);
      if (res.data?.whatsapp) {
        toast.success('✅ Número verificado con WhatsApp');
        // Todo verificado! Cerrar
        onVerified(cedulaResult);
        setTimeout(onClose, 1500);
      } else {
        setError('El número no tiene WhatsApp activo');
        setStep('result');
      }
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Error al verificar WhatsApp';
      setError(msg);
      setStep('result');
    } finally {
      setVerifying(false);
    }
  };

  const skipWhatsApp = () => {
    onVerified(cedulaResult);
    toast.success('✅ Verificación completada');
    setTimeout(onClose, 800);
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

        {/* Pasos: indicator */}
        <div className="px-8 pt-8 flex items-center gap-2">
          {[1, 2].map(i => {
            const active =
              (i === 1 && !['intro', 'whatsapp', 'verifying-whatsapp'].includes(step)) ||
              (i === 2 && ['whatsapp', 'verifying-whatsapp'].includes(step));
            const done =
              (i === 1 && ['cedula-verified', 'whatsapp', 'verifying-whatsapp'].includes(step)) ||
              (i === 2 && step === 'whatsapp');
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done || active ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  {done ? '✓' : i}
                </div>
                <span className={`text-xs ${done || active ? 'text-slate-300' : 'text-slate-600'}`}>
                  {i === 1 ? 'Cédula' : 'WhatsApp'}
                </span>
                {i === 1 && <div className="flex-1 h-px bg-slate-800" />}
              </div>
            );
          })}
        </div>

        {/* INTRO */}
        {step === 'intro' && (
          <div className="px-8 pt-5 pb-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center mx-auto">
              <Shield size={32} className="text-indigo-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Verifica tu identidad</h2>
              <p className="text-sm text-slate-400">
                Necesitamos confirmar tu identidad en 2 pasos rápidos contra el Registro Civil y WhatsApp.
              </p>
            </div>

            <div className="bg-slate-800 rounded-2xl p-5 space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                  <UserCheck size={16} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Paso 1: Cédula</p>
                  <p className="text-xs text-slate-500">Consultamos tu cédula contra el Registro Civil en tiempo real</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center flex-shrink-0">
                  <Smartphone size={16} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Paso 2: WhatsApp</p>
                  <p className="text-xs text-slate-500">Verificamos que tu celular tenga WhatsApp activo</p>
                </div>
              </div>
            </div>

            <button onClick={() => setStep('cedula')}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors text-sm">
              Comenzar
            </button>
            <p className="text-xs text-slate-600">$0.05 de costo operativo · Consulta contra DIGERCIC y WhatsApp</p>
          </div>
        )}

        {/* CEDULA INPUT */}
        {step === 'cedula' && (
          <div className="px-8 pt-5 pb-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Paso 1: Ingresa tu cédula</h2>
              <p className="text-sm text-slate-400">Tu número será consultado contra el Registro Civil para verificar tu identidad.</p>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2 font-medium">Número de cédula</label>
              <input
                value={cedula}
                onChange={e => { setCedula(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleVerifyCedula()}
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

            <button onClick={handleVerifyCedula} disabled={cedula.length !== 10 || verifying}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors text-sm">
              {verifying ? 'Verificando...' : 'Verificar cédula'}
            </button>

            <button onClick={() => setStep('intro')} className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors">
              ← Atrás
            </button>
          </div>
        )}

        {/* VERIFYING CEDULA */}
        {step === 'verifying-cedula' && (
          <div className="px-8 pt-5 pb-8 text-center space-y-5">
            <Loader2 size={40} className="animate-spin text-indigo-400 mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold text-white">Consultando al Registro Civil</p>
              <p className="text-sm text-slate-400">Verificando cédula {cedula}...</p>
            </div>
          </div>
        )}

        {/* CEDULA VERIFIED — now ask for WhatsApp */}
        {step === 'cedula-verified' && cedulaResult && (
          <div className="px-8 pt-5 pb-8 space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={26} className="text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">✅ Cédula verificada</h2>
              <p className="text-sm text-slate-400 mt-1">Tu cédula está activa en el Registro Civil.</p>
            </div>

            <div className="bg-slate-800 rounded-2xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Nombres</span>
                <span className="text-white font-medium">{cedulaResult.verification?.nombres || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Apellidos</span>
                <span className="text-white font-medium">{cedulaResult.verification?.apellidos || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estado</span>
                <span className="text-green-400 font-medium">{cedulaResult.verification?.estado}</span>
              </div>
            </div>

            {/* WhatsApp step */}
            <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
              <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                <Smartphone size={16} className="text-green-400" />
                Paso 2: Verifica tu WhatsApp
              </h3>
              <p className="text-xs text-slate-400 mb-4">Confirmamos que tu número tenga WhatsApp activo para recibir notificaciones.</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">+593</span>
                  <input
                    value={phone}
                    onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyWhatsApp()}
                    placeholder="99 000 0000"
                    inputMode="numeric"
                    autoFocus
                    className="w-full pl-14 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={handleVerifyWhatsApp} disabled={verifying || phone.length < 9}
                className="w-full py-3.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                {verifying ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Phone size={16} />
                )}
                {verifying ? 'Verificando...' : 'Verificar con WhatsApp'}
              </button>
              <button onClick={skipWhatsApp}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                Omitir verificación WhatsApp y continuar
              </button>
            </div>
          </div>
        )}

        {/* VERIFYING WHATSAPP */}
        {step === 'verifying-whatsapp' && (
          <div className="px-8 pt-5 pb-8 text-center space-y-5">
            <Loader2 size={40} className="animate-spin text-indigo-400 mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold text-white">Verificando WhatsApp</p>
              <p className="text-sm text-slate-400">Consultando si +593 {phone} tiene WhatsApp activo...</p>
            </div>
          </div>
        )}

        {/* RESULT — error general */}
        {step === 'result' && (
          <div className="px-8 pt-5 pb-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle size={34} className="text-red-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Algo salió mal</h2>
              <p className="text-sm text-slate-400">{error || 'No se pudo completar la verificación. Intenta de nuevo.'}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => {
                if (cedulaResult?.verification?.nombres) {
                  setStep('cedula-verified');
                } else {
                  setStep('cedula');
                }
                setError('');
              }}
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

        {/* Footer */}
        <div className="px-8 pb-5">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
            <Shield size={10} />
            <span>Datos consultados contra DIGERCIC + WhatsApp vía WebServices.ec</span>
          </div>
        </div>
      </div>
    </div>
  );
}
