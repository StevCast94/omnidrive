// ===== components/Conversacion.tsx =====
// El hilo de mensajes de una reserva.
//
// Va dentro del detalle de la reserva, no en una pantalla aparte: el contexto
// de la conversación es siempre "este vehículo, estas fechas", y separarlo
// obliga a recordar de qué se estaba hablando.

import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { messages as api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface Mensaje {
  id: string;
  text: string;
  senderId: string;
  read: boolean;
  createdAt: string;
  sender: { name: string; lastName: string; avatarUrl: string | null };
}

function hora(fecha: string) {
  return new Date(fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function dia(fecha: string) {
  const d = new Date(fecha);
  const hoy = new Date();
  const ayer = new Date(Date.now() - 86400000);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long' });
}

export default function Conversacion({ bookingId }: { bookingId: string }) {
  const { user } = useAuthStore();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const finDelHilo = useRef<HTMLDivElement>(null);

  const cargar = async (primeraVez = false) => {
    try {
      const { data } = await api.hilo(bookingId);
      setMensajes(prev => {
        // Sólo se re-renderiza si de verdad cambió algo: si no, el sondeo
        // haría saltar el scroll cada pocos segundos.
        const nuevos = data.data.mensajes;
        return nuevos.length === prev.length && nuevos.at(-1)?.id === prev.at(-1)?.id ? prev : nuevos;
      });
      if (primeraVez) setCargando(false);
    } catch {
      if (primeraVez) setCargando(false);
    }
  };

  useEffect(() => {
    cargar(true);
    const t = setInterval(cargar, 12_000);
    return () => clearInterval(t);
  }, [bookingId]);

  useEffect(() => {
    finDelHilo.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [mensajes.length]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || enviando) return;

    setEnviando(true);
    // El mensaje aparece al instante y se confirma después: escribir y esperar
    // a que el servidor responda para ver lo que escribiste se siente roto.
    const provisional: Mensaje = {
      id: `temp-${Date.now()}`,
      text: limpio,
      senderId: user!.id,
      read: false,
      createdAt: new Date().toISOString(),
      sender: { name: user!.name, lastName: user!.lastName, avatarUrl: null },
    };
    setMensajes(m => [...m, provisional]);
    setTexto('');

    try {
      const { data } = await api.enviar(bookingId, limpio);
      setMensajes(m => m.map(x => (x.id === provisional.id ? data.data : x)));
    } catch (err: any) {
      setMensajes(m => m.filter(x => x.id !== provisional.id));
      setTexto(limpio); // no se pierde lo escrito
      toast.error(err.response?.data?.error ?? 'No pudimos enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  };

  let ultimoDia = '';

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <MessageSquare size={15} className="text-cyan-400" />
        Mensajes
      </h3>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="max-h-80 overflow-y-auto p-4 space-y-3">
          {cargando ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : mensajes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Todavía no hay mensajes. Escribe para coordinar la entrega.
            </p>
          ) : (
            mensajes.map(m => {
              const mio = m.senderId === user?.id;
              const diaDeEste = dia(m.createdAt);
              const cambioDeDia = diaDeEste !== ultimoDia;
              ultimoDia = diaDeEste;

              return (
                <div key={m.id}>
                  {cambioDeDia && (
                    <p className="text-center text-[11px] text-slate-600 my-3">{diaDeEste}</p>
                  )}
                  <div className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                        mio ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-100'
                      } ${m.id.startsWith('temp-') ? 'opacity-60' : ''}`}
                    >
                      {!mio && (
                        <p className="text-[11px] font-semibold text-cyan-300 mb-0.5">
                          {m.sender.name}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={`text-[10px] mt-1 ${mio ? 'text-cyan-100/70' : 'text-slate-500'}`}>
                        {hora(m.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={finDelHilo} />
        </div>

        <form onSubmit={enviar} className="flex gap-2 border-t border-slate-800 p-3">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escribe un mensaje…"
            maxLength={2000}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            aria-label="Enviar mensaje"
            className="shrink-0 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      <p className="text-xs text-slate-500">
        Los mensajes quedan guardados en la reserva. Si hay una disputa, es lo que podemos revisar.
      </p>
    </section>
  );
}
