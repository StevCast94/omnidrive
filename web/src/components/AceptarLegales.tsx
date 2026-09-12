// ===== components/AceptarLegales.tsx =====
// Casilla de aceptación de los textos legales.
//
// Se muestra donde hace falta aceptar: al reservar y al publicar un vehículo.
// El servidor lo exige de todos modos —la casilla se puede saltar, el registro
// con versión, fecha e IP es lo que vale en una disputa— así que esto existe
// para que la persona sepa a qué dice que sí, no para bloquear nada.

import { useState, useEffect } from 'react';
import { Link } from '@/lib/router-exports';
import { legal } from '@/lib/api';

interface Props {
  /** Se llama con true cuando ya está todo aceptado. */
  onCambio: (alDia: boolean) => void;
  bookingId?: string;
}

export default function AceptarLegales({ onCambio, bookingId }: Props) {
  const [pendientes, setPendientes] = useState<string[] | null>(null);
  const [marcado, setMarcado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    legal.estadoMio()
      .then(r => {
        setPendientes(r.data.data.pendientes);
        onCambio(r.data.data.alDia);
      })
      .catch(() => {
        // Si no podemos saberlo, no bloqueamos: el servidor lo exigirá igual.
        setPendientes([]);
        onCambio(true);
      });
  }, []);

  const aceptar = async (valor: boolean) => {
    setMarcado(valor);
    if (!valor) { onCambio(false); return; }

    setGuardando(true);
    setError('');
    try {
      await legal.aceptar(undefined, bookingId);
      setPendientes([]);
      onCambio(true);
    } catch {
      setMarcado(false);
      setError('No pudimos registrar tu aceptación. Inténtalo otra vez.');
      onCambio(false);
    } finally {
      setGuardando(false);
    }
  };

  // Nada pendiente: ya aceptó esta versión y no hay que molestarle otra vez.
  if (pendientes === null || pendientes.length === 0) return null;

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
      <label className="flex gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={marcado}
          disabled={guardando}
          onChange={e => aceptar(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-500"
        />
        <span className="text-sm text-slate-300 leading-relaxed">
          He leído y acepto los{' '}
          <Link to="/legal/terminos" className="text-cyan-400 hover:underline">términos y condiciones</Link>,
          la <Link to="/legal/privacidad" className="text-cyan-400 hover:underline">política de privacidad</Link>{' '}
          y la <Link to="/legal/cancelacion" className="text-cyan-400 hover:underline">política de cancelación</Link>.
        </span>
      </label>

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
