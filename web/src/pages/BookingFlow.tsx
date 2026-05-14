import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from '@/lib/router-exports';
import { Shield, AlertTriangle, Car, ChevronRight, Check, CreditCard, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { vehicles as vehiclesApi, bookings as bookingsApi, payments } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const STEPS = ['Detalles', 'Seguro', 'Pago', 'Confirmación'];

export default function BookingFlow() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();

  const startAt = sp.get('startAt') ?? '';
  const endAt = sp.get('endAt') ?? '';

  const [step, setStep] = useState(0);
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<any>(null);

  const [opts, setOpts] = useState({
    withDriver: false,
    hasInsurance: false,
    liabilityWaiver: false,
    tenantAccepted: false,
    payWithWallet: user?.subscriptionTier !== 'free',
  });

  useEffect(() => {
    vehiclesApi.get(vehicleId!)
      .then(r => setVehicle(r.data.data))
      .catch(() => { toast.error('Vehículo no encontrado'); navigate('/vehicles'); })
      .finally(() => setLoading(false));
  }, [vehicleId]);

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
    </div>
  );
  if (!vehicle) return null;

  // ── Price calc ──
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  const hours = ms / 3600000;
  const days = Math.ceil(hours / 24) || 1;
  const base = days >= 1
    ? days * Number(vehicle.pricePerDay)
    : Math.ceil(hours) * Number(vehicle.pricePerHour);
  const driverFee = opts.withDriver && vehicle.withDriver ? Number(vehicle.driverPrice ?? 0) * days : 0;
  const insuranceFee = opts.hasInsurance ? 5 * days : 0;
  const service = (base + driverFee + insuranceFee) * 0.15;
  const total = base + driverFee + insuranceFee + service;
  const deposit = Number(vehicle.deposit);

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  // ── Submit booking ──
  const handleSubmit = async () => {
    if (!opts.hasInsurance && !opts.tenantAccepted)
      return toast.error('Debes aceptar la cláusula de responsabilidad');
    setSubmitting(true);
    try {
      const { data: res } = await bookingsApi.create({
        vehicleId, startAt, endAt,
        withDriver: opts.withDriver,
        hasInsurance: opts.hasInsurance,
        liabilityWaiver: !opts.hasInsurance,
        insuranceDetails: opts.hasInsurance ? { type: 'platform_insurance' } : null,
      });
      setBooking(res.data);

      // Hold deposit from wallet if subscribed
      if (opts.payWithWallet && deposit > 0) {
        await payments.hold(res.data.id);
        updateUser({ walletBalance: Number(user!.walletBalance) - deposit });
      }

      setStep(3);
      toast.success('¡Reserva creada exitosamente!');
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al crear la reserva');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Steps ──
  const StepDetails = () => (
    <div className="space-y-5">
      <div className="bg-slate-800 rounded-2xl p-5 flex gap-4">
        {vehicle.photos?.[0]
          ? <img src={vehicle.photos[0]} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" alt="" />
          : <div className="w-20 h-20 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0"><Car size={28} className="text-slate-500" /></div>
        }
        <div>
          <p className="text-xs text-indigo-400 font-medium uppercase">{vehicle.category}</p>
          <h2 className="font-bold text-white text-lg">{vehicle.brand} {vehicle.model} {vehicle.year}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{vehicle.locationName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Inicio</p>
          <p className="text-sm font-medium text-white">{new Date(startAt).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Fin</p>
          <p className="text-sm font-medium text-white">{new Date(endAt).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500 mb-1">Duración</p>
        <p className="text-sm font-medium text-white">{days} día{days !== 1 ? 's' : ''} ({Math.round(hours)} horas)</p>
      </div>

      {vehicle.withDriver && (
        <label className="flex items-center gap-3 bg-slate-800 rounded-xl p-4 cursor-pointer">
          <input type="checkbox" checked={opts.withDriver}
            onChange={e => setOpts(o => ({ ...o, withDriver: e.target.checked }))}
            className="accent-indigo-500 w-4 h-4" />
          <div>
            <p className="text-sm font-medium text-white">Incluir chofer</p>
            <p className="text-xs text-slate-400">+{fmt(Number(vehicle.driverPrice ?? 0))}/día</p>
          </div>
        </label>
      )}

      <PriceSummary />
      <button onClick={() => setStep(1)}
        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
        Continuar <ChevronRight size={16} />
      </button>
    </div>
  );

  const StepInsurance = () => (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white">Cobertura de seguro</h2>

      {/* Option A — Platform insurance */}
      <label className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${opts.hasInsurance ? 'border-green-500 bg-green-500/5' : 'border-slate-700 bg-slate-800'}`}>
        <input type="radio" checked={opts.hasInsurance} onChange={() => setOpts(o => ({ ...o, hasInsurance: true, tenantAccepted: false, liabilityWaiver: false }))}
          className="accent-green-500 mt-0.5 w-4 h-4" />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} className="text-green-400" />
            <p className="font-semibold text-white">Seguro de plataforma</p>
            <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">Recomendado</span>
          </div>
          <p className="text-sm text-slate-400">Cobertura básica contra daños y robo durante el alquiler.</p>
          <p className="text-sm font-medium text-green-400 mt-1">$5.00/día · {fmt(insuranceFee > 0 ? 5 * days : 5 * days)} total</p>
        </div>
      </label>

      {/* Option B — No insurance / waiver */}
      <label className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${!opts.hasInsurance ? 'border-yellow-500 bg-yellow-500/5' : 'border-slate-700 bg-slate-800'}`}>
        <input type="radio" checked={!opts.hasInsurance} onChange={() => setOpts(o => ({ ...o, hasInsurance: false }))}
          className="accent-yellow-500 mt-0.5 w-4 h-4" />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-yellow-400" />
            <p className="font-semibold text-white">Sin seguro — bajo mi responsabilidad</p>
          </div>
          <p className="text-sm text-slate-400">Asumes toda la responsabilidad por daños, robos o accidentes.</p>
        </div>
      </label>

      {/* Liability waiver — shown only when no insurance */}
      {!opts.hasInsurance && (
        <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-2xl p-5 space-y-3">
          <div className="flex gap-2">
            <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-300 mb-2">Cláusula de responsabilidad</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                "Entiendo que alquilo este vehículo <strong>sin cobertura de seguro</strong>. Acepto asumir toda la responsabilidad por daños, robos o accidentes que ocurran durante el período de alquiler. Esta declaración tiene validez legal y digital."
              </p>
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer mt-2">
            <input type="checkbox" checked={opts.tenantAccepted}
              onChange={e => setOpts(o => ({ ...o, tenantAccepted: e.target.checked }))}
              className="accent-yellow-500 w-4 h-4 mt-0.5" />
            <span className="text-sm text-slate-300">
              He leído y acepto la cláusula de responsabilidad. Entiendo que el propietario también deberá aceptar antes de confirmar la reserva.
            </span>
          </label>
        </div>
      )}

      <PriceSummary />

      <div className="flex gap-3">
        <button onClick={() => setStep(0)} className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors">
          Atrás
        </button>
        <button
          onClick={() => {
            if (!opts.hasInsurance && !opts.tenantAccepted) return toast.error('Debes aceptar la cláusula');
            setStep(2);
          }}
          className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
          Continuar <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  const StepPayment = () => (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white">Método de pago</h2>

      {user?.subscriptionTier !== 'free' && (
        <label className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${opts.payWithWallet ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-700 bg-slate-800'}`}>
          <input type="radio" checked={opts.payWithWallet} onChange={() => setOpts(o => ({ ...o, payWithWallet: true }))} className="accent-indigo-500 w-4 h-4 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={16} className="text-indigo-400" />
              <p className="font-semibold text-white">Wallet OmniDrive</p>
              <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded-full">P2P</span>
            </div>
            <p className="text-sm text-slate-400">Saldo disponible: <span className="text-white font-medium">{fmt(Number(user?.walletBalance ?? 0))}</span></p>
          </div>
        </label>
      )}

      <label className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${!opts.payWithWallet ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-700 bg-slate-800'}`}>
        <input type="radio" checked={!opts.payWithWallet} onChange={() => setOpts(o => ({ ...o, payWithWallet: false }))} className="accent-indigo-500 w-4 h-4 mt-0.5" />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={16} className="text-indigo-400" />
            <p className="font-semibold text-white">Tarjeta de crédito/débito</p>
          </div>
          <p className="text-sm text-slate-400">Pago seguro vía Stripe</p>
        </div>
      </label>

      {/* Summary */}
      <PriceSummary showDeposit />

      <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400 space-y-1">
        <p>• El depósito se retiene y se devuelve al finalizar el viaje sin daños.</p>
        <p>• El pago total se procesa al confirmar la reserva.</p>
        <p>• El propietario recibirá el pago cuando marque el viaje como completado.</p>
      </div>

      <div className="flex gap-3">
        <button onClick={() => setStep(1)} className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors">
          Atrás
        </button>
        <button onClick={handleSubmit} disabled={submitting}
          className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors">
          {submitting ? 'Procesando...' : `Confirmar · ${fmt(total + deposit)}`}
        </button>
      </div>
    </div>
  );

  const StepConfirmed = () => (
    <div className="text-center space-y-6 py-8">
      <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/30">
        <Check size={36} className="text-green-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">¡Reserva enviada!</h2>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          El propietario tiene hasta 24 horas para confirmar tu solicitud. Te notificaremos de inmediato.
        </p>
      </div>
      {booking && (
        <div className="bg-slate-800 rounded-xl p-4 text-left space-y-2 text-sm">
          <p className="text-slate-400">ID de reserva: <span className="text-white font-mono">{booking.id.slice(0, 8).toUpperCase()}</span></p>
          <p className="text-slate-400">Estado: <span className="text-yellow-400 font-medium">Pendiente de confirmación</span></p>
          <p className="text-slate-400">Total: <span className="text-white font-medium">{fmt(Number(booking.totalAmount))}</span></p>
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={() => navigate('/dashboard')}
          className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-sm transition-colors">
          Ver mis reservas
        </button>
        <button onClick={() => navigate('/vehicles')}
          className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors">
          Seguir explorando
        </button>
      </div>
    </div>
  );

  const PriceSummary = ({ showDeposit = false }: { showDeposit?: boolean }) => (
    <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
      <div className="flex justify-between text-slate-300">
        <span>{fmt(Number(vehicle.pricePerDay))}/día × {days} día{days !== 1 ? 's' : ''}</span>
        <span>{fmt(base)}</span>
      </div>
      {driverFee > 0 && <div className="flex justify-between text-slate-400"><span>Chofer</span><span>{fmt(driverFee)}</span></div>}
      {opts.hasInsurance && <div className="flex justify-between text-slate-400"><span>Seguro</span><span>{fmt(insuranceFee)}</span></div>}
      <div className="flex justify-between text-slate-400"><span>Comisión plataforma (15%)</span><span>{fmt(service)}</span></div>
      <div className="flex justify-between font-bold text-white border-t border-slate-700 pt-2">
        <span>Total</span><span>{fmt(total)}</span>
      </div>
      {showDeposit && deposit > 0 && (
        <div className="flex justify-between text-slate-500 text-xs">
          <span>Depósito reembolsable</span><span>{fmt(deposit)}</span>
        </div>
      )}
    </div>
  );

  const stepContent = [<StepDetails />, <StepInsurance />, <StepPayment />, <StepConfirmed />];

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Progress */}
      {step < 3 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i < step ? 'bg-indigo-600 text-white' : i === step ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? 'text-white font-medium' : 'text-slate-500'}`}>{s}</span>
                {i < STEPS.length - 1 && <div className="w-8 sm:w-16 h-px bg-slate-700 mx-1" />}
              </div>
            ))}
          </div>
        </div>
      )}
      {stepContent[step]}
    </div>
  );
}
