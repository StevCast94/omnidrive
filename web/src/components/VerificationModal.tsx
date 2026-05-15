import { useState, useRef, useEffect } from 'react';
import { X, Shield, CheckCircle, AlertTriangle, Loader2, Camera, Upload, CreditCard, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth as authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (data: any) => void;
}

type Step = 'intro' | 'document' | 'selfie' | 'uploading' | 'success' | 'error';

export default function VerificationModal({ isOpen, onClose, onVerified }: Props) {
  const { user, updateUser } = useAuthStore();
  const [step, setStep] = useState<Step>('intro');
  const [errorMsg, setErrorMsg] = useState('');

  // Documento — fotos capturadas
  const [documentFrontFile, setDocumentFrontFile] = useState<File | null>(null);
  const [documentBackFile, setDocumentBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  // Previsualizaciones
  const [docFrontPreview, setDocFrontPreview] = useState<string | null>(null);
  const [docBackPreview, setDocBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  // Cámara
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [cameraMode, setCameraMode] = useState<'document' | 'selfie' | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      setStep('intro');
      setErrorMsg('');
      setDocumentFrontFile(null);
      setDocumentBackFile(null);
      setSelfieFile(null);
      setDocFrontPreview(null);
      setDocBackPreview(null);
      setSelfiePreview(null);
      setCameraMode(null);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ─── Cámara ───────────────────────────────────────
  const startCamera = async (mode: 'document' | 'selfie') => {
    setCameraMode(mode);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: mode === 'document'
          ? { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: false,
      });
      setStream(s);
      // Wait for next tick so videoRef is mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      // Fallback: usar input file
      setCameraMode(null);
      fileInputRef.current?.click();
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraMode) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `${cameraMode}-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const preview = URL.createObjectURL(blob);

      if (cameraMode === 'document') {
        if (!documentFrontFile) {
          setDocumentFrontFile(file);
          setDocFrontPreview(preview);
          toast('Ahora toma la foto del reverso del documento', { icon: '📄' });
        } else if (!documentBackFile) {
          setDocumentBackFile(file);
          setDocBackPreview(preview);
        }
      } else {
        setSelfieFile(file);
        setSelfiePreview(preview);
      }

      // Stop camera
      if (stream) stream.getTracks().forEach(t => t.stop());
      setStream(null);
      setCameraMode(null);
    }, 'image/jpeg', 0.85);
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
    setCameraMode(null);
  };

  // ─── Subida de fotos por file input ─────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (target === 'front') {
      setDocumentFrontFile(file);
      setDocFrontPreview(preview);
    } else {
      setDocumentBackFile(file);
      setDocBackPreview(preview);
    }
  };

  const handleSelfieUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  // ─── Subir todo ─────────────────────────────────────
  const handleUpload = async () => {
    if (!documentFrontFile || !documentBackFile || !selfieFile) {
      toast.error('Debes tomar ambas fotos del documento y la selfie');
      return;
    }

    setStep('uploading');
    setErrorMsg('');

    try {
      const fd = new FormData();
      fd.append('selfie', selfieFile);
      fd.append('documentFront', documentFrontFile);
      fd.append('documentBack', documentBackFile);

      const { data: res } = await authApi.verifyIdentity(fd);
      if (res.error) {
        setErrorMsg(res.error);
        setStep('error');
        return;
      }

      // Actualizar store con URLs
      updateUser({
        selfieUrl: res.data.user.selfieUrl,
        identityVerified: false, // Pendiente de revisión manual
      });

      setStep('success');
      toast.success('✅ Documentos subidos correctamente');
      setTimeout(() => {
        onVerified(res.data);
        onClose();
      }, 2000);
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Error al subir los documentos';
      setErrorMsg(msg);
      setStep('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-600 hover:text-white z-10 transition-colors">
          <X size={20} />
        </button>

        {/* ─── INTRO ─────────────────────────────────── */}
        {step === 'intro' && (
          <div className="px-8 pt-8 pb-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center mx-auto">
              <Shield size={32} className="text-indigo-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Verifica tu identidad</h2>
              <p className="text-sm text-slate-400">
                Para poder operar en OmniDrive necesitas subir una foto de tu documento de identidad y una selfie.
                Tus datos están protegidos y solo se usan para verificación.
              </p>
            </div>

            <div className="bg-slate-800 rounded-2xl p-5 space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                  <CreditCard size={16} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">1. Fotos del documento</p>
                  <p className="text-xs text-slate-500">Toma foto frontal y reverso de tu cédula o pasaporte</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center flex-shrink-0">
                  <Camera size={16} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">2. Selfie</p>
                  <p className="text-xs text-slate-500">Toma una selfie para confirmar tu identidad</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-600/20 flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">3. Revisión</p>
                  <p className="text-xs text-slate-500">Nuestro equipo revisa tus documentos y te notifica</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => { setStep('document'); setErrorMsg(''); }}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors text-sm"
            >
              Comenzar verificación
            </button>
            <p className="text-xs text-slate-600">Tus documentos se almacenan de forma segura en Supabase Storage con cifrado</p>
          </div>
        )}

        {/* ─── DOCUMENTO ──────────────────────────────── */}
        {step === 'document' && (
          <div className="px-8 pt-8 pb-8 space-y-5">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Foto del documento</h2>
              <p className="text-sm text-slate-400">
                Toma una foto clara del <strong>frente</strong> y <strong>reverso</strong> de tu cédula o pasaporte.
              </p>
            </div>

            {/* Cámara activa */}
            {cameraMode === 'document' && (
              <div className="space-y-3">
                <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3]">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 border-4 border-indigo-400/50 rounded-2xl pointer-events-none" />
                  <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/50 px-3 py-1 rounded-full">
                    {!documentFrontFile ? 'Foto frontal' : 'Foto reverso'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={capturePhoto}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium text-sm"
                  >
                    Tomar foto
                  </button>
                  <button onClick={stopCamera}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-slate-300"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Preview o selector */}
            {cameraMode !== 'document' && (
              <div className="space-y-4">
                {/* Frente */}
                <div className={`border-2 border-dashed rounded-2xl p-4 text-center transition-colors ${docFrontPreview ? 'border-green-500/50' : 'border-slate-700'}`}>
                  {docFrontPreview ? (
                    <div className="space-y-2">
                      <img src={docFrontPreview} className="max-h-40 mx-auto rounded-xl object-contain" alt="Frente documento" />
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => { setDocumentFrontFile(null); setDocFrontPreview(null); }}
                          className="text-xs text-slate-400 hover:text-red-400"
                        >
                          Eliminar
                        </button>
                        <button onClick={() => startCamera('document')}
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          Retomar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => startCamera('document')} className="w-full py-6 space-y-2">
                      <Upload size={28} className="mx-auto text-slate-500" />
                      <p className="text-sm font-medium text-slate-300">Foto frontal del documento</p>
                      <p className="text-xs text-slate-500">Usa la cámara o selecciona un archivo</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={e => handleFileUpload(e, 'front')}
                        className="hidden"
                      />
                    </button>
                  )}
                </div>

                {/* Reverso */}
                <div className={`border-2 border-dashed rounded-2xl p-4 text-center transition-colors ${docBackPreview ? 'border-green-500/50' : 'border-slate-700'}`}>
                  {docBackPreview ? (
                    <div className="space-y-2">
                      <img src={docBackPreview} className="max-h-40 mx-auto rounded-xl object-contain" alt="Reverso documento" />
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => { setDocumentBackFile(null); setDocBackPreview(null); }}
                          className="text-xs text-slate-400 hover:text-red-400"
                        >
                          Eliminar
                        </button>
                        <button onClick={() => startCamera('document')}
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          Retomar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { if (docFrontPreview) startCamera('document'); else toast.error('Primero toma la foto frontal'); }}
                      className="w-full py-6 space-y-2"
                    >
                      <Upload size={28} className="mx-auto text-slate-500" />
                      <p className="text-sm font-medium text-slate-300">Foto reverso del documento</p>
                      <p className="text-xs text-slate-500">Toma la foto después de la frontal</p>
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep('intro')}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-slate-300"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={() => {
                      if (!documentFrontFile || !documentBackFile) {
                        toast.error('Debes tomar ambas fotos del documento');
                        return;
                      }
                      setStep('selfie');
                      setErrorMsg('');
                    }}
                    disabled={!documentFrontFile || !documentBackFile}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium text-sm"
                  >
                    Siguiente — Selfie
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── SELFIE ────────────────────────────────── */}
        {step === 'selfie' && (
          <div className="px-8 pt-8 pb-8 space-y-5">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Selfie</h2>
              <p className="text-sm text-slate-400">
                Toma una selfie clara, sin lentes ni gorra, con buena iluminación.
              </p>
            </div>

            {cameraMode === 'selfie' && (
              <div className="space-y-3">
                <div className="relative bg-black rounded-2xl overflow-hidden aspect-[3/4] max-w-xs mx-auto">
                  <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 border-4 border-green-400/50 rounded-2xl pointer-events-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={capturePhoto}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-medium text-sm"
                  >
                    Tomar selfie
                  </button>
                  <button onClick={stopCamera}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-slate-300"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {cameraMode !== 'selfie' && (
              <div className="space-y-4">
                {selfiePreview ? (
                  <div className="space-y-3">
                    <img src={selfiePreview} className="max-h-64 mx-auto rounded-2xl object-contain" alt="Selfie" />
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => { setSelfieFile(null); setSelfiePreview(null); }}
                        className="text-xs text-slate-400 hover:text-red-400"
                      >
                        Eliminar
                      </button>
                      <button onClick={() => startCamera('selfie')}
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        Retomar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-700 rounded-2xl">
                    <button onClick={() => startCamera('selfie')} className="w-full py-8 space-y-3">
                      <Camera size={36} className="mx-auto text-slate-500" />
                      <p className="text-sm font-medium text-slate-300">Abrir cámara frontal</p>
                      <p className="text-xs text-slate-500">O selecciona una foto de tu galería</p>
                    </button>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handleSelfieUpload}
                      className="hidden"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => { setStep('document'); stopCamera(); }}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-slate-300"
                  >
                    Atrás
                  </button>
                  <button onClick={handleUpload} disabled={!selfieFile}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <Upload size={16} />
                    Subir documentos
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── SUBIENDO ───────────────────────────────── */}
        {step === 'uploading' && (
          <div className="px-8 pt-12 pb-12 text-center space-y-5">
            <Loader2 size={48} className="animate-spin text-indigo-400 mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold text-white text-lg">Subiendo documentos...</p>
              <p className="text-sm text-slate-400">Estamos almacenando tus fotos de forma segura.</p>
            </div>
            <div className="w-48 h-1.5 bg-slate-800 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* ─── ÉXITO ──────────────────────────────────── */}
        {step === 'success' && (
          <div className="px-8 pt-10 pb-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle size={34} className="text-green-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">¡Documentos subidos!</h2>
              <p className="text-sm text-slate-400">
                Hemos recibido tus fotos. Un revisor verificará tus documentos y te notificaremos cuando esté listo.
              </p>
            </div>
          </div>
        )}

        {/* ─── ERROR ──────────────────────────────────── */}
        {step === 'error' && (
          <div className="px-8 pt-8 pb-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle size={34} className="text-red-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Algo salió mal</h2>
              <p className="text-sm text-slate-400">{errorMsg || 'No pudimos subir tus documentos. Intenta de nuevo.'}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setStep('document'); setErrorMsg(''); }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium text-sm"
              >
                Intentar de nuevo
              </button>
              <button onClick={onClose}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium text-sm text-slate-400"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 pb-5">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
            <Shield size={10} />
            <span>Documentos almacenados en Supabase Storage con cifrado AES-256</span>
          </div>
        </div>
      </div>
    </div>
  );
}
