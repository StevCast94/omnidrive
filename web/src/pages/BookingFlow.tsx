import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from '@/lib/router-exports';
import { Car, ChevronRight, Check, FileText, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { vehicles as vehiclesApi, bookings as bookingsApi } from '@/lib/api';

export default function BookingFlow() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const startAt = sp.get('startAt') ?? '';
  const endAt = sp.get('endAt') ?? '';

  const [step, setStep] = useState(0);
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  useEffect(() => {
    vehiclesApi.get(vehicleId!)
      .then(r => setVehicle(r.data.data))
      .catch(() => { toast.error('Vehículo no encontrado'); navigate('/vehicles'); })
      .finally(() => setLoading(false));
  }, [vehicleId]);

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto" />
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
  const total = base;
  const deposit = Number(vehicle.deposit);

  const [disclaimerExpanded, setDisclaimerExpanded] = useState(false);

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  // ── Submit booking ──
  const handleSubmit = async () => {
    if (!disclaimerAccepted)
      return toast.error('Debes aceptar el descargo de responsabilidad');
    setSubmitting(true);
    try {
      const { data: res } = await bookingsApi.create({
        vehicleId, startAt, endAt,
        hasInsurance: false,
        liabilityWaiver: true,
        insuranceDetails: {
          disclaimerAccepted: true,
          disclaimerAcceptedAt: new Date().toISOString(),
        },
      });
      setBooking(res.data);
      setStep(1);
      toast.success('¡Solicitud enviada al propietario!');
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
          <p className="text-xs text-cyan-400 font-medium uppercase">{vehicle.category || 'Vehículo'}</p>
          <h2 className="font-bold text-white text-lg">{vehicle.brand} {vehicle.model} {vehicle.year}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{vehicle.locationName || vehicle.location}</p>
          {vehicle.owner?.phone && (
            <p className="text-xs text-slate-500 mt-1">
              WhatsApp: <span className="text-cyan-400">{vehicle.owner.phone}</span>
            </p>
          )}
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

      {/* Disclaimer — colapsable */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-white">Descargo de responsabilidad</p>
              <button
                type="button"
                onClick={() => setDisclaimerExpanded(!disclaimerExpanded)}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex-shrink-0 ml-2"
              >
                {disclaimerExpanded ? 'Ver menos' : 'Ver más'}
                {disclaimerExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Resumen siempre visible */}
            <p className="text-xs text-slate-400 leading-relaxed">
              OmniDrive es una plataforma <strong>P2P de contacto</strong> entre el dueño de un vehículo y el arrendatario.{' '}
              <strong className="text-cyan-400">No intervenimos en el proceso de alquiler</strong>, no gestionamos pagos, 
              no recibimos comisiones, ni resolvemos disputas.
            </p>

            {/* Contenido completo — solo si expandido */}
            {disclaimerExpanded && (
              <div className="mt-3 text-xs text-slate-300 leading-relaxed space-y-3 border-t border-slate-700/50 pt-3">
                <div className="bg-cyan-900/20 border border-cyan-800/30 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-cyan-300">Nuestra visión</p>
                  <p className="text-slate-400">
                    OmniDrive nace con el propósito de <strong className="text-slate-200">optimizar los recursos</strong>{' '}
                    de nuestra comunidad: convertir vehículos pasivos en activos productivos, aportar a un modelo de movilidad
                    más eficiente y sostenible, ofrecer filtros de seguridad sólidos basados en verificación de identidad,
                    rastreo opcional con dispositivo móvil y un sistema de calificaciones, y sobre todo,{' '}
                    <strong className="text-slate-200">construir una comunidad sólida</strong> donde la confianza sea la base
                    de cada transacción.
                  </p>
                </div>

                <p className="font-medium text-slate-200">Al aceptar este descargo, entiendo y reconozco que:</p>
                <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                  <li><strong className="text-slate-300">OmniDrive solo facilita el contacto</strong> entre las partes interesadas.</li>
                  <li>El acuerdo de alquiler, condiciones, depósito, forma de pago y plazos se negocian <strong className="text-slate-300">directamente entre el dueño y el arrendatario</strong>, sin intervención de la plataforma.</li>
                  <li>OmniDrive <strong className="text-slate-300">no se hace responsable</strong> por daños, robos, accidentes, incumplimientos contractuales o disputas entre las partes.</li>
                  <li>OmniDrive <strong className="text-slate-300">no recibe comisiones, fees ni ningún tipo de ingreso</strong> por las transacciones acordadas entre usuarios. Es un directorio gratuito de contacto.</li>
                  <li>OmniDrive <strong className="text-slate-300">no interviene en la resolución de disputas</strong>. Las partes deben resolver sus diferencias de forma directa o mediante las autoridades competentes.</li>
                  <li>OmniDrive provee herramientas complementarias de seguridad como <strong className="text-slate-300">verificación de identidad</strong> con documentos, <strong className="text-slate-300">sistema de calificación</strong> post-viaje, <strong className="text-slate-300">rastreo opcional con dispositivo móvil</strong> durante el alquiler, y registro de incidentes para <strong className="text-slate-300">vetos internos</strong> dentro de la comunidad.</li>
                  <li>El <strong className="text-slate-300">sistema de calificación (Score)</strong> permite a la comunidad conocer la confiabilidad de cada usuario basado en experiencias previas.</li>
                </ul>
                <p className="text-slate-500 italic mt-2">
                  Al marcar la casilla abajo, aceptas este descargo de manera explícita y voluntaria.
                </p>
              </div>
            )}
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-slate-700">
          <input
            type="checkbox"
            checked={disclaimerAccepted}
            onChange={e => setDisclaimerAccepted(e.target.checked)}
            className="accent-cyan-500 w-5 h-5 mt-0.5 rounded flex-shrink-0"
          />
          <span className="text-sm text-slate-200 leading-relaxed">
            He leído, entiendo y <strong>acepto el descargo de responsabilidad</strong>. Reconozco que OmniDrive es únicamente un servicio de contacto P2P y que el acuerdo de alquiler se realiza directamente con el propietario del vehículo.
          </span>
        </label>
      </div>

      {/* Price */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between text-slate-300">
          <span>{fmt(Number(vehicle.pricePerDay))}/día × {days} día{days !== 1 ? 's' : ''}</span>
          <span>{fmt(base)}</span>
        </div>
        <div className="flex justify-between font-bold text-white border-t border-slate-700 pt-2">
          <span>Total (pagas al dueño)</span><span>{fmt(total)}</span>
        </div>
        {deposit > 0 && (
          <div className="flex justify-between text-slate-500 text-xs border-t border-slate-700/50 pt-2">
            <span>Depósito reembolsable (acordar con el dueño)</span><span>{fmt(deposit)}</span>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || !disclaimerAccepted}
        className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? 'Enviando...' : 'Enviar solicitud al propietario'}
        {!submitting && <ChevronRight size={16} />}
      </button>
    </div>
  );

  /* ───────── Paso 2: Confirmación ───────── */
  const StepConfirmed = () => {
    const ownerPhone = vehicle.owner?.phone || vehicle.phone;
    const waMsg = ownerPhone
      ? `https://wa.me/${ownerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
          `Hola! Vi tu ${vehicle.brand} ${vehicle.model} ${vehicle.year} en OmniDrive y me interesa alquilarlo del ${new Date(startAt).toLocaleDateString('es-EC')} al ${new Date(endAt).toLocaleDateString('es-EC')}. ¿Disponible?`
        )}`
      : null;

    return (
      <div className="max-lg mx-auto px-4 py-8">
        <div className="text-center space-y-6 py-8">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/30">
            <Check size={36} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">¡Solicitud enviada!</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              El propietario ha recibido tu solicitud. Ahora deben coordinar directamente los detalles del alquiler.
            </p>
          </div>

          {/* Contactar por WhatsApp */}
          {waMsg && (
            <a
              href={waMsg}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-semibold text-sm transition-colors"
            >
              <MessageCircle size={20} />
              Contactar al dueño por WhatsApp
            </a>
          )}

          {booking && (
            <div className="bg-slate-800 rounded-xl p-4 text-left space-y-2 text-sm">
              <p className="text-slate-400">ID de solicitud: <span className="text-white font-mono">{booking.id.slice(0, 8).toUpperCase()}</span></p>
              <p className="text-slate-400">Estado: <span className="text-yellow-400 font-medium">Pendiente — contacta al dueño</span></p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => navigate('/dashboard')}
              className="flex-1 py-3.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-semibold text-sm transition-colors">
              Ver mis solicitudes
            </button>
            <button onClick={() => navigate('/vehicles')}
              className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors">
              Seguir explorando
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {step === 0 && <StepDetails />}
      {step === 1 && <StepConfirmed />}
    </div>
  );
}
