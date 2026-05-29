import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from '@/lib/router-exports';
import {
  ChevronLeft, Car, Check, Clock, Play, Camera,
  Flag, AlertTriangle, Star, MapPin, Navigation, MessageCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { bookings as bookingsApi, reviewsApi, tracking } from '@/lib/api';
import ContactModal from '@/components/ContactModal';
import { useAuthStore } from '@/lib/store';

const TIMELINE = [
  { key: 'pending',   label: 'Solicitud enviada',  icon: Clock },
  { key: 'confirmed', label: 'Confirmada',          icon: Check },
  { key: 'active',    label: 'En curso',            icon: Play },
  { key: 'completed', label: 'Completada',          icon: Flag },
];

const STATUS_ORDER = ['pending', 'confirmed', 'active', 'completed'];

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [disputeText, setDisputeText] = useState('');
  const [trackingPoints, setTrackingPoints] = useState<any[]>([]);
  const trackInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBooking = async () => {
    try {
      const { data: res } = await bookingsApi.get(id!);
      setBooking(res.data);
    } catch { toast.error('Error al cargar la reserva'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBooking(); }, [id]);

  // GPS tracking - tenant sends location every 30s during active booking
  useEffect(() => {
    if (!booking || booking.status !== 'active' || booking.tenantId !== user?.id) return;
    const send = () => {
      navigator.geolocation?.getCurrentPosition(pos => {
        tracking.report(id!, { lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    };
    send();
    trackInterval.current = setInterval(send, 30000);
    return () => { if (trackInterval.current) clearInterval(trackInterval.current); };
  }, [booking?.status]);

  // Poll tracking points if owner & active
  useEffect(() => {
    if (!booking || booking.status !== 'active') return;
    const poll = () => tracking.get(id!).then(r => setTrackingPoints(r.data.data.points ?? [])).catch(() => {});
    poll();
    const t = setInterval(poll, 15000);
    return () => clearInterval(t);
  }, [booking?.status]);

  const action = async (label: string, fn: () => Promise<any>) => {
    setActionLoading(label);
    try { await fn(); await fetchBooking(); }
    catch (e: any) { toast.error(e.response?.data?.error ?? 'Error'); }
    finally { setActionLoading(''); }
  };

  const uploadPhotos = async (type: 'before' | 'after') => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      const fd = new FormData();
      files.forEach(f => fd.append('photos', f));
      await action(`photos-${type}`, () =>
        type === 'before' ? bookingsApi.uploadPhotosBefore(id!, fd) : bookingsApi.uploadPhotosAfter(id!, fd)
      );
      toast.success('Fotos subidas');
    };
    input.click();
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
    </div>
  );
  if (!booking) return <div className="text-center py-24 text-slate-500">Reserva no encontrada</div>;

  const isOwner = booking.vehicle?.owner?.id === user?.id;
  const isTenant = booking.tenantId === user?.id;
  const statusIdx = STATUS_ORDER.indexOf(booking.status);
  const isDisputed = booking.status === 'disputed';
  const isCancelled = booking.status === 'cancelled';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ChevronLeft size={16} /> Mis reservas
      </button>

      {/* Vehicle card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex gap-4">
        <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0">
          {booking.vehicle?.photos?.[0]
            ? <img src={booking.vehicle.photos[0]} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full flex items-center justify-center"><Car size={20} className="text-slate-600" /></div>}
        </div>
        <div>
          <p className="text-xs text-indigo-400 font-medium uppercase">{booking.vehicle?.category}</p>
          <h2 className="font-bold text-white">{booking.vehicle?.brand} {booking.vehicle?.model} {booking.vehicle?.year}</h2>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <MapPin size={11} /> {booking.vehicle?.locationName ?? 'Sin ubicación'}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-slate-500">Total</p>
          <p className="font-bold text-white">${Number(booking.totalAmount).toFixed(2)}</p>
        </div>
      </div>

      {/* Timeline */}
      {!isCancelled && !isDisputed && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-5">Estado de la reserva</h3>
          <div className="relative">
            <div className="absolute left-3.5 top-4 bottom-4 w-px bg-slate-700" />
            <div className="space-y-5">
              {TIMELINE.map((t, i) => {
                const done = i <= statusIdx;
                const current = i === statusIdx;
                const Icon = t.icon;
                return (
                  <div key={t.key} className="flex items-center gap-4 relative">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center z-10 flex-shrink-0 transition-colors ${done ? 'bg-indigo-600' : 'bg-slate-800 border border-slate-700'}`}>
                      <Icon size={13} className={done ? 'text-white' : 'text-slate-600'} />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${current ? 'text-white' : done ? 'text-slate-300' : 'text-slate-600'}`}>{t.label}</p>
                      {current && <p className="text-xs text-indigo-400">Estado actual</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dispute / cancelled badge */}
      {(isDisputed || isCancelled) && (
        <div className={`rounded-2xl p-4 border flex items-center gap-3 ${isDisputed ? 'bg-orange-500/5 border-orange-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <AlertTriangle size={18} className={isDisputed ? 'text-orange-400' : 'text-red-400'} />
          <div>
            <p className="font-medium text-white">{isDisputed ? 'Disputa abierta' : 'Reserva cancelada'}</p>
            {isDisputed && booking.damageReport?.description && (
              <p className="text-sm text-slate-400 mt-0.5">{booking.damageReport.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Booking details */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Detalles</h3>
        {[
          ['ID', booking.id.slice(0, 8).toUpperCase()],
          ['Inicio', new Date(booking.startAt).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })],
          ['Fin', new Date(booking.endAt).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })],
          ['Seguro', booking.vehicle?.insurance
            ? '✅ Incluye seguro (SOAT/privado)'
            : '⚠️ Sin seguro verificado'],
          ['Chofer', booking.withDriver ? 'Sí' : 'No'],
          ['Depósito', `$${Number(booking.deposit).toFixed(2)}`],
          ['Estado pago', booking.paymentStatus],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span className="text-slate-500">{k}</span>
            <span className="text-slate-200 font-medium text-right">{v}</span>
          </div>
        ))}
      </div>

      {/* Live tracking map (owner view, active booking) */}
      {isOwner && booking.status === 'active' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Navigation size={16} className="text-green-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-white">Ubicación en tiempo real</h3>
            <span className="text-xs text-green-400 ml-auto">{trackingPoints.length} puntos</span>
          </div>
          {trackingPoints.length > 0 ? (
            <div className="bg-slate-800 rounded-xl p-3 text-sm text-slate-300 space-y-1">
              <p>Última posición:</p>
              <p className="font-mono text-xs text-indigo-300">
                {trackingPoints[trackingPoints.length - 1]?.lat?.toFixed(5)}, {trackingPoints[trackingPoints.length - 1]?.lng?.toFixed(5)}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(trackingPoints[trackingPoints.length - 1]?.ts).toLocaleTimeString('es-EC')}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Esperando ubicación del arrendatario...</p>
          )}
        </div>
      )}

      {/* Photos */}
      {(booking.photosBefore?.length > 0 || booking.photosAfter?.length > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Fotos del vehículo</h3>
          {[['Entrega', booking.photosBefore], ['Devolución', booking.photosAfter]].map(([label, photos]) =>
            (photos as string[])?.length > 0 ? (
              <div key={label as string}>
                <p className="text-xs text-slate-500 mb-2">{label as string}</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {(photos as string[]).map((p, i) => (
                    <img key={i} src={p} className="w-20 h-20 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(p, '_blank')} alt="" />
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {/* OWNER actions */}
        {isOwner && booking.status === 'pending' && (
          <div className="grid grid-cols-2 gap-3">
            <button disabled={!!actionLoading}
              onClick={() => action('confirm', () => bookingsApi.confirm(id!, { ownerAcceptsWaiver: !booking.hasInsurance }))}
              className="py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {actionLoading === 'confirm' ? '...' : <><Check size={16} /> Confirmar</>}
            </button>
            <button disabled={!!actionLoading}
              onClick={() => action('cancel', () => bookingsApi.cancel(id!))}
              className="py-3 bg-red-600/20 hover:bg-red-600/40 text-red-400 disabled:opacity-50 border border-red-500/20 rounded-xl text-sm font-semibold transition-colors">
              {actionLoading === 'cancel' ? '...' : 'Rechazar'}
            </button>
          </div>
        )}

        {isOwner && booking.status === 'confirmed' && (
          <div className="space-y-3">
            <button onClick={() => uploadPhotos('before')} disabled={!!actionLoading}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              <Camera size={16} /> Tomar fotos de entrega
            </button>
            <button disabled={!!actionLoading}
              onClick={() => action('start', () => bookingsApi.start(id!))}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {actionLoading === 'start' ? '...' : <><Play size={14} /> Iniciar viaje</>}
            </button>
          </div>
        )}

        {isOwner && booking.status === 'active' && (
          <div className="space-y-3">
            <button onClick={() => uploadPhotos('after')} disabled={!!actionLoading}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              <Camera size={16} /> Tomar fotos de devolución
            </button>
            <button disabled={!!actionLoading}
              onClick={() => action('end', () => bookingsApi.end(id!))}
              className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {actionLoading === 'end' ? '...' : <><Flag size={16} /> Confirmar devolución</>}
            </button>
          </div>
        )}

        {/* TENANT actions */}
        {isTenant && booking.status === 'confirmed' && (
          <div className="bg-slate-900 border border-indigo-500/20 rounded-2xl p-4 text-center">
            <p className="text-sm text-slate-400">El dueño debe iniciar el viaje</p>
            <p className="text-xs text-slate-500 mt-1">Una vez que el propietario tome las fotos de entrega, iniciará tu viaje</p>
          </div>
        )}

        {/* Contactar al dueño/inquilino */}
        <button onClick={() => setContactOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-medium text-sm transition-colors">
          <MessageCircle size={16} className="text-cyan-400" />
          {isOwner ? 'Contactar al inquilino' : 'Contactar al dueño'}
        </button>

        {/* Cancel - both can cancel if pending/confirmed */}
        {(isTenant || isOwner) && ['pending', 'confirmed'].includes(booking.status) && (
          <button disabled={!!actionLoading}
            onClick={() => action('cancel', () => bookingsApi.cancel(id!))}
            className="w-full py-3 border border-red-500/20 text-red-400 hover:bg-red-500/10 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors">
            {actionLoading === 'cancel' ? 'Cancelando...' : 'Cancelar reserva'}
          </button>
        )}

        {/* Review — completed, cualquiera de los dos puede calificar al otro */}
        {booking.status === 'completed' && !booking.review && (isTenant || isOwner) && (
          <button onClick={() => setShowReview(true)}
            className="w-full py-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            <Star size={16} /> {isTenant ? 'Calificar al dueño' : 'Calificar al arrendatario'}
          </button>
        )}

        {/* Dispute - owner, completed/active */}
        {isOwner && ['active', 'completed'].includes(booking.status) && !isDisputed && (
          <button onClick={() => setShowDispute(true)}
            className="w-full py-3 border border-orange-500/20 text-orange-400 hover:bg-orange-500/10 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <AlertTriangle size={16} /> Reportar disputa
          </button>
        )}
      </div>

      {/* Review modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-5">
            <div className="text-center">
              <h3 className="font-bold text-white text-lg">
                {isTenant ? 'Calificar al dueño' : 'Calificar al arrendatario'}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {isTenant
                  ? `¿Cómo fue tu experiencia con ${booking.vehicle?.owner?.name || 'el dueño'}?`
                  : `¿Cómo fue tu experiencia con ${booking.tenant?.name || 'el arrendatario'}?`}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setReviewForm(f => ({ ...f, rating: n }))}>
                  <Star size={32} className={n <= reviewForm.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'} />
                </button>
              ))}
            </div>
            <textarea value={reviewForm.comment}
              onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
              placeholder="Cuenta cómo te fue (opcional)..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setShowReview(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={async () => {
                const targetId = isTenant ? booking.vehicle?.owner?.id : booking.tenantId;
                await reviewsApi.create({ bookingId: id, targetId: targetId, rating: reviewForm.rating, comment: reviewForm.comment });
                toast.success('Reseña enviada'); setShowReview(false); fetchBooking();
                // Recargar booking para mostrar la reseña
              }} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-colors">Enviar reseña</button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute modal */}
      {showDispute && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-5">
            <h3 className="font-bold text-white text-lg">Reportar disputa</h3>
            <p className="text-sm text-slate-400">Describe el problema con detalle. Un administrador revisará el caso.</p>
            <textarea value={disputeText} onChange={e => setDisputeText(e.target.value)}
              placeholder="Describe los daños o el problema..." rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setShowDispute(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button disabled={!disputeText.trim()} onClick={async () => {
                await action('dispute', () => bookingsApi.dispute(id!, disputeText));
                setShowDispute(false);
              }} className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">Enviar disputa</button>
            </div>
          </div>
        </div>
      )}

      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        bookingId={booking.id}
        vehicle={{
          id: booking.vehicle.id,
          brand: booking.vehicle.brand,
          model: booking.vehicle.model,
        }}
        targetUser={isOwner ? {
          id: booking.tenant?.id || booking.tenantId,
          name: booking.tenant?.name && booking.tenant?.lastName
            ? `${booking.tenant.name} ${booking.tenant.lastName}`
            : (booking.tenant?.name || 'el inquilino'),
          phone: booking.tenant?.phone,
        } : {
          id: booking.vehicle.owner?.id || booking.vehicle.ownerId,
          name: booking.vehicle.owner
            ? `${booking.vehicle.owner.name} ${booking.vehicle.owner.lastName}`
            : 'el dueño',
          phone: booking.vehicle.owner?.phone,
        }}
      />
    </div>
  );
}
