// ===== components/RastreoEnVivo.tsx =====
// El mapa en vivo de una reserva activa.
//
// Muestra cosas distintas según quién mira: quien conduce ve el interruptor
// para compartir su ubicación y cuántos puntos le quedan por enviar; el dueño
// ve dónde está su vehículo y puede definir una zona.
//
// El sello de "hace N s" no es decoración: un mapa en vivo que se congela sin
// avisar es peor que no tener mapa.

import { useState, useEffect, useRef } from 'react';
import { MapPin, Radio, ShieldAlert, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Mapa, { type PuntoMapa } from './Mapa';
import { tracking } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { iniciarRastreo, seguirEnVivo, type Punto, type Rastreador } from '@/lib/rastreo';

interface Props {
  bookingId: string;
  soyElInquilino: boolean;
  activa: boolean;
}

function haceCuanto(fecha: string | Date | null): string {
  if (!fecha) return 'sin datos';
  const s = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000);
  if (s < 10) return 'ahora mismo';
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  return `hace ${Math.floor(s / 3600)} h`;
}

export default function RastreoEnVivo({ bookingId, soyElInquilino, activa }: Props) {
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [ultimo, setUltimo] = useState<Punto | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const [zona, setZona] = useState<{ lat: number; lng: number; radioKm: number } | null>(null);
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(Date.now());

  const rastreador = useRef<Rastreador | null>(null);

  // Reloj propio para que el "hace N s" avance aunque no lleguen puntos: es
  // justamente cuando deja de llegar nada cuando hay que notarlo.
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    tracking.get(bookingId)
      .then(r => {
        const d = r.data.data;
        setPuntos(d.puntos ?? []);
        setUltimo(d.ultimo ?? null);
        setCompartiendo(Boolean(d.activo));
      })
      .catch(() => {});
  }, [bookingId]);

  // Quien mira (dueño o inquilino) recibe los puntos en vivo.
  useEffect(() => {
    if (!activa) return;
    let vivo = true;

    (async () => {
      const token = await getAccessToken();
      if (!vivo) return;
      const cerrar = seguirEnVivo(bookingId, p => {
        setUltimo(p);
        setPuntos(prev => [...prev, p]);
      }, token);
      return cerrar;
    })();

    return () => { vivo = false; };
  }, [bookingId, activa]);

  const alternarCompartir = async (activar: boolean) => {
    try {
      await tracking.consentimiento(bookingId, activar);
      setCompartiendo(activar);

      if (activar) {
        rastreador.current = iniciarRastreo(bookingId, {
          onPunto: p => { setUltimo(p); setPuntos(prev => [...prev, p]); },
          onError: setError,
        });
        const t = setInterval(() => setPendientes(rastreador.current?.pendientes() ?? 0), 5000);
        return () => clearInterval(t);
      }

      rastreador.current?.detener();
      rastreador.current = null;
      toast.success('Dejaste de compartir tu ubicación');
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'No pudimos cambiar el rastreo');
    }
  };

  // Al desmontar, parar el GPS: seguir capturando con la pantalla cerrada
  // gastaría batería sin que nadie lo haya pedido.
  useEffect(() => () => { rastreador.current?.detener(); }, []);

  const marcadores: PuntoMapa[] = ultimo
    ? [{ lat: ultimo.lat, lng: ultimo.lng, tipo: 'actual', etiqueta: 'Ubicación actual' }]
    : [];

  const frescura = ultimo ? Math.floor((ahora - new Date(ultimo.recordedAt).getTime()) / 1000) : null;
  const congelado = frescura !== null && frescura > 120;

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Radio size={15} className={compartiendo ? 'text-emerald-400' : 'text-slate-500'} />
          Ubicación en vivo
        </h3>

        {ultimo && (
          <span className={`text-xs tabular-nums ${congelado ? 'text-amber-400' : 'text-slate-500'}`}>
            {congelado && '⚠ '}actualizado {haceCuanto(ultimo.recordedAt)}
          </span>
        )}
      </header>

      {soyElInquilino && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <label className="flex gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={compartiendo}
              onChange={e => alternarCompartir(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
            />
            <span className="text-sm text-slate-300 leading-relaxed">
              Compartir mi ubicación con el anfitrión durante este alquiler.
              <span className="block text-xs text-slate-500 mt-1">
                Se apaga solo al finalizar. Sólo la ve el dueño de este vehículo, y
                se borra a los 90 días. Puedes desactivarla cuando quieras.
              </span>
            </span>
          </label>

          {pendientes > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-amber-400 mt-3">
              <WifiOff size={12} /> {pendientes} punto{pendientes !== 1 ? 's' : ''} sin enviar; se mandarán al recuperar señal
            </p>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-400 mt-3">
              <ShieldAlert size={12} /> {error}
            </p>
          )}
        </div>
      )}

      {compartiendo || puntos.length > 0 ? (
        <>
          <Mapa
            centro={ultimo ? { lat: ultimo.lat, lng: ultimo.lng } : undefined}
            zoom={14}
            puntos={marcadores}
            recorrido={puntos}
            zona={zona}
            alto="320px"
          />

          {ultimo && (
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Puntos', String(puntos.length)],
                ['Velocidad', ultimo.speed != null ? `${Math.round(ultimo.speed * 3.6)} km/h` : '—'],
                ['Precisión', ultimo.accuracy != null ? `${Math.round(ultimo.accuracy)} m` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-900 border border-slate-800 rounded-xl py-2.5">
                  <dt className="text-[11px] text-slate-500">{k}</dt>
                  <dd className="text-sm font-semibold text-white tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
          <MapPin className="mx-auto text-slate-600 mb-2" size={22} />
          <p className="text-sm text-slate-400">
            {soyElInquilino
              ? 'Activa el rastreo para compartir tu recorrido con el anfitrión.'
              : 'El inquilino todavía no ha compartido su ubicación.'}
          </p>
        </div>
      )}
    </section>
  );
}
