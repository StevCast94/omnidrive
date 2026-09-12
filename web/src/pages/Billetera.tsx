// ===== web/src/pages/Billetera.tsx =====
// Saldo, movimientos, recargas y retiros.
//
// La distinción entre disponible y retenido es lo primero que se ve: el
// retenido es dinero que sigue siendo tuyo pero que ya está comprometido en
// una reserva, y no verlo separado es la forma más rápida de que alguien crea
// que le falta dinero.

import { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, Lock, Wallet as IconoBilletera, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { payments } from '@/lib/api';
import { formatearDinero, usePais } from '@/lib/money';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

interface Saldo { disponible: number; retenido: number; total: number; moneda: string }

interface Movimiento {
  id: string;
  tipo: string;
  estado: string;
  monto: number;
  direccion: 'entrada' | 'salida';
  descripcion: string | null;
  fecha: string;
}

const ETIQUETA: Record<string, string> = {
  deposit: 'Recarga',
  withdrawal: 'Retiro',
  payment: 'Pago de alquiler',
  refund: 'Devolución',
  commission: 'Comisión',
  hold: 'Retención por reserva',
  subscription: 'Suscripción',
};

const ESTADO: Record<string, { texto: string; clase: string }> = {
  pending: { texto: 'Pendiente', clase: 'text-amber-400' },
  completed: { texto: '', clase: '' },
  failed: { texto: 'Rechazado', clase: 'text-red-400' },
  reversed: { texto: 'Revertido', clase: 'text-slate-500' },
};

export default function Billetera() {
  const pais = usePais(s => s.pais);
  const { user } = useAuthStore();

  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [panel, setPanel] = useState<'ninguno' | 'recarga' | 'retiro'>('ninguno');
  const [enviando, setEnviando] = useState(false);

  const [montoRecarga, setMontoRecarga] = useState('');
  const [referencia, setReferencia] = useState('');
  const [comprobante, setComprobante] = useState<File | null>(null);

  const [montoRetiro, setMontoRetiro] = useState('');
  const [banco, setBanco] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [titular, setTitular] = useState('');

  const cargar = async () => {
    try {
      const [s, m] = await Promise.all([payments.saldo(), payments.movimientos()]);
      setSaldo(s.data.data);
      setMovs(m.data.data);
    } catch {
      toast.error('No pudimos cargar tu billetera');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const enviarRecarga = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('monto', montoRecarga);
      fd.append('metodo', 'transferencia');
      if (referencia) fd.append('referencia', referencia);
      if (comprobante) fd.append('comprobante', comprobante);

      const { data } = await payments.recargar(fd);
      toast.success(data.data.mensaje);
      setPanel('ninguno');
      setMontoRecarga(''); setReferencia(''); setComprobante(null);
      cargar();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'No pudimos registrar la recarga');
    } finally {
      setEnviando(false);
    }
  };

  const enviarRetiro = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await payments.retirar({ monto: montoRetiro, banco, numeroCuenta, titular });
      toast.success('Retiro solicitado. Te transferimos en cuanto lo revisemos.');
      setPanel('ninguno');
      setMontoRetiro(''); setBanco(''); setNumeroCuenta(''); setTitular('');
      cargar();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'No pudimos solicitar el retiro');
    } finally {
      setEnviando(false);
    }
  };

  if (!user) {
    return <p className="max-w-3xl mx-auto px-4 py-16 text-slate-400">Inicia sesión para ver tu billetera.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-2.5">
        <IconoBilletera className="text-cyan-400" size={22} />
        <h1 className="text-2xl font-bold text-white">Tu billetera</h1>
      </div>

      {/* Saldo */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Disponible</p>
          <p className="text-3xl font-bold text-white mt-1 tabular-nums">
            {cargando ? '—' : formatearDinero(saldo?.disponible ?? 0, { decimales: true })}
          </p>
          <p className="text-xs text-slate-500 mt-1">Puedes usarlo para reservar o retirarlo</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Lock size={11} /> Retenido
          </p>
          <p className="text-3xl font-bold text-slate-300 mt-1 tabular-nums">
            {cargando ? '—' : formatearDinero(saldo?.retenido ?? 0, { decimales: true })}
          </p>
          <p className="text-xs text-slate-500 mt-1">Comprometido en reservas en curso</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button className="flex-1" onClick={() => setPanel(panel === 'recarga' ? 'ninguno' : 'recarga')}>
          Recargar
        </Button>
        <Button
          className="flex-1"
          variant="secondary"
          onClick={() => setPanel(panel === 'retiro' ? 'ninguno' : 'retiro')}
          disabled={!saldo?.disponible}
        >
          Retirar
        </Button>
      </div>

      {/* Recarga */}
      {panel === 'recarga' && (
        <form onSubmit={enviarRecarga} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex gap-2.5 text-sm text-slate-400 bg-slate-800/60 rounded-xl p-3">
            <Info size={16} className="shrink-0 mt-0.5 text-cyan-400" />
            <p>
              Transfiere el importe a nuestra cuenta y registra aquí la operación.
              Tu saldo se acredita cuando confirmemos que el dinero entró, normalmente el mismo día.
            </p>
          </div>

          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">Importe ({pais.currencySymbol})</span>
            <input
              type="number" step="0.01" min="5" required inputMode="decimal"
              value={montoRecarga} onChange={e => setMontoRecarga(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>

          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">Número de referencia de la transferencia</span>
            <input
              value={referencia} onChange={e => setReferencia(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>

          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">Comprobante (opcional, agiliza la confirmación)</span>
            <input
              type="file" accept="image/*,application/pdf"
              onChange={e => setComprobante(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-300"
            />
          </label>

          <Button type="submit" className="w-full" isLoading={enviando}>Registrar recarga</Button>
        </form>
      )}

      {/* Retiro */}
      {panel === 'retiro' && (
        <form onSubmit={enviarRetiro} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <p className="text-sm text-slate-400">
            Transferimos a tu cuenta bancaria. El importe sale de tu saldo disponible al solicitarlo.
          </p>

          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">Importe ({pais.currencySymbol})</span>
            <input
              type="number" step="0.01" min="0.01" required inputMode="decimal"
              value={montoRetiro} onChange={e => setMontoRetiro(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            {([['Banco', banco, setBanco], ['Titular de la cuenta', titular, setTitular]] as const).map(([l, v, set]) => (
              <label key={l} className="block">
                <span className="block text-xs text-slate-400 mb-1">{l}</span>
                <input
                  required value={v} onChange={e => set(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>
            ))}
          </div>

          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">Número de cuenta</span>
            <input
              required value={numeroCuenta} onChange={e => setNumeroCuenta(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>

          <Button type="submit" className="w-full" isLoading={enviando}>Solicitar retiro</Button>
        </form>
      )}

      {/* Movimientos */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Movimientos</h2>

        {cargando ? (
          <p className="text-slate-500 text-sm">Cargando…</p>
        ) : movs.length === 0 ? (
          <p className="text-slate-500 text-sm bg-slate-900 border border-slate-800 rounded-2xl p-5">
            Todavía no hay movimientos. Cuando recargues o completes una reserva, aparecerán aquí.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {movs.map(m => {
              const entra = m.direccion === 'entrada';
              const estado = ESTADO[m.estado];
              return (
                <li key={m.id} className="flex items-center gap-3 p-4">
                  <span className={`shrink-0 rounded-full p-2 ${entra ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {entra ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{ETIQUETA[m.tipo] ?? m.tipo}</p>
                    <p className="text-xs text-slate-500 truncate">{m.descripcion}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold tabular-nums ${entra ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {entra ? '+' : '−'}{formatearDinero(m.monto, { decimales: true })}
                    </p>
                    {estado?.texto && <p className={`text-[11px] ${estado.clase}`}>{estado.texto}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
