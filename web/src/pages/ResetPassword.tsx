// ===== web/src/pages/ResetPassword.tsx =====
// Aqui aterriza el enlace del correo: /#/reset-password?token=...
// El token se usa una sola vez y caduca en una hora.

import { useState, useEffect } from 'react';
import { useNavigate } from '@/lib/router-exports';
import { ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '@/lib/api';
import { Logo } from '@/components/ui/Logo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // El router es por hash, asi que la query viaja detras del '#'.
    const query = window.location.search;
    const t = new URLSearchParams(query).get('token');
    if (t) setToken(t);
    else setError('Este enlace no trae token. Pide uno nuevo desde "Olvidé mi contraseña".');
  }, []);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return setError('La contraseña debe incluir letras y números');
    }
    if (password !== confirmacion) return setError('Las contraseñas no coinciden');

    setError('');
    setLoading(true);
    try {
      await auth.resetPassword(token, password);
      setListo(true);
      toast.success('Contraseña actualizada');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'No se pudo actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-1.5 text-slate-500 hover:text-white mb-4 transition-colors text-sm"
        >
          <ArrowLeft size={16} /> Volver a iniciar sesión
        </button>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-8 rounded-2xl shadow-lg">
          <div className="text-center mb-8">
            <Logo variant="icon" animated className="mx-auto mb-4 w-14" />
            <h2 className="text-2xl font-bold text-white">Nueva contraseña</h2>
          </div>

          {listo ? (
            <div className="text-center space-y-5">
              <CheckCircle className="mx-auto text-emerald-400" size={44} />
              <p className="text-slate-300 text-sm">
                Listo. Cerramos las sesiones que estuvieran abiertas con la contraseña anterior.
              </p>
              <Button className="w-full" size="lg" onClick={() => navigate('/login')}>
                Iniciar sesión
              </Button>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-5">
              <div className="relative">
                <Input
                  label="Nueva contraseña"
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(!verPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <Input
                label="Repite la contraseña"
                type={verPassword ? 'text' : 'password'}
                value={confirmacion}
                onChange={e => setConfirmacion(e.target.value)}
                required
                autoComplete="new-password"
              />

              <p className="text-xs text-slate-500">Mínimo 8 caracteres, con letras y números.</p>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button type="submit" className="w-full" size="lg" isLoading={loading} disabled={!token}>
                Guardar contraseña
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
