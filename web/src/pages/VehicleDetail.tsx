import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from '@/lib/router-exports';
import {
  Star, MapPin, Users, Fuel, Settings, Shield, CheckCircle,
  Car, ChevronLeft, ChevronRight, Calendar, UserCheck, BadgeCheck
} from 'lucide-react';
import { vehicles as vehiclesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

const FEATURE_LABELS: Record<string, string> = {
  ac: 'Aire acondicionado', gps: 'GPS', bluetooth: 'Bluetooth',
  usb: 'Puerto USB', backup_camera: 'Cámara trasera',
  sunroof: 'Techo solar', leather: 'Asientos de cuero',
};

export default function VehicleDetail() {
  const params = useParams();
  const id = params.id;
  const navigate = useNavigate();
  const goBack = () => window.history.back();
  const { user } = useAuthStore();
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);

  // Check-in / Check-out como hoteles
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const CHECKIN_HOUR = '14:00';
  const CHECKOUT_HOUR = '12:00';
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    vehiclesApi.get(id!)
      .then(r => setVehicle(r.data.data))
      .catch(() => toast.error('Vehículo no encontrado'))
      .finally(() => setLoading(false));
  }, [id]);

  const getStartAtISO = () => startDate ? `${startDate}T${CHECKIN_HOUR}:00.000Z` : '';
  const getEndAtISO = () => endDate ? `${endDate}T${CHECKOUT_HOUR}:00.000Z` : '';

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (!val) { setEndDate(''); return; }
    const minEnd = new Date(val);
    minEnd.setDate(minEnd.getDate() + 1);
    const minEndStr = minEnd.toISOString().split('T')[0];
    if (!endDate || endDate <= val) {
      setEndDate(minEndStr);
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
  };

  const minEndDate = startDate
    ? new Date(new Date(startDate).getTime() + 86400000).toISOString().split('T')[0]
    : todayStr;

  const calcNights = () => {
    if (!startDate || !endDate) return 0;
    const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(1, Math.round(ms / 86400000));
  };

  const formatDateLong = (d: string) => {
    if (!d) return '';
    return new Date(d + 'T12:00:00').toLocaleDateString('es-EC', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  const handleBook = () => {
    if (!user) { navigate('/login'); return; }
    if (!startDate || !endDate) { toast.error('Selecciona las fechas'); return; }
    if (new Date(endDate) <= new Date(startDate)) { toast.error('La fecha de fin debe ser posterior al inicio'); return; }
    navigate(`/book/${vehicle.id}?startAt=${encodeURIComponent(getStartAtISO())}&endAt=${encodeURIComponent(getEndAtISO())}`);
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="h-96 bg-slate-900 rounded-2xl animate-pulse border border-slate-800" />
    </div>
  );
  if (!vehicle) return (
    <div className="text-center py-24 text-slate-500">Vehículo no encontrado</div>
  );

  const photos = vehicle.photos?.length ? vehicle.photos : [];
  const isOwner = user?.id === vehicle.ownerId;
  const nights = calcNights();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back */}
      <button onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
        <ChevronLeft size={16} /> Volver
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo gallery */}
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden h-72 md:h-96 border border-slate-800">
            {photos.length > 0 ? (
              <>
                <img src={photos[photoIdx]} alt="" className="w-full h-full object-cover" />
                {photos.length > 1 && (
                  <>
                    <button onClick={() => setPhotoIdx(i => (i - 1 + photos.length) % photos.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors">
                      <ChevronLeft size={20} />
                    </button>
                    <button onClick={() => setPhotoIdx(i => (i + 1) % photos.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors">
                      <ChevronRight size={20} />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {photos.map((_: any, i: number) => (
                        <button key={i} onClick={() => setPhotoIdx(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${i === photoIdx ? 'bg-white' : 'bg-white/40'}`} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <Car size={64} />
              </div>
            )}
          </div>

          {/* Title & rating */}
          <div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-indigo-400 text-sm font-medium uppercase tracking-wide mb-1">{vehicle.category}</p>
                <h1 className="text-3xl font-bold text-white">{vehicle.brand} {vehicle.model} {vehicle.year}</h1>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <Star size={16} className="text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold text-white">{vehicle.rating > 0 ? vehicle.rating.toFixed(1) : 'Nuevo'}</span>
                </div>
                <p className="text-xs text-slate-500">{vehicle.reviews?.length ?? 0} reseñas</p>
              </div>
            </div>

            {vehicle.locationName && (
              <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-2">
                <MapPin size={14} /> {vehicle.locationName}
              </div>
            )}
          </div>

          {/* Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Users, label: `${vehicle.seats} asientos` },
              { icon: Settings, label: vehicle.transmission === 'automatic' ? 'Automático' : 'Manual' },
              { icon: Fuel, label: vehicle.fuelType },
              { icon: Car, label: `${vehicle.mileage?.toLocaleString()} km` },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-2">
                <Icon size={16} className="text-indigo-400 flex-shrink-0" />
                <span className="text-sm text-slate-300">{label}</span>
              </div>
            ))}
          </div>

          {/* Features */}
          {vehicle.features?.length > 0 && (
            <div>
              <h3 className="font-semibold text-white mb-3">Características</h3>
              <div className="flex flex-wrap gap-2">
                {vehicle.features.map((f: string) => (
                  <span key={f} className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-300">
                    <CheckCircle size={13} className="text-green-400" />
                    {FEATURE_LABELS[f] ?? f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Insurance */}
          <div className={`rounded-xl p-4 border flex items-start gap-3 ${vehicle.insurance ? 'bg-green-500/5 border-green-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
            <Shield size={18} className={vehicle.insurance ? 'text-green-400 mt-0.5' : 'text-yellow-400 mt-0.5'} />
            <div>
              <p className="text-sm font-medium text-white">
                {vehicle.insurance ? 'Seguro vigente incluido' : 'Sin seguro del propietario'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {vehicle.insurance
                  ? `Vence: ${vehicle.insuranceExpires ? new Date(vehicle.insuranceExpires).toLocaleDateString('es-EC') : 'Vigente'}`
                  : 'Puedes contratar el seguro de la plataforma por $5/día'}
              </p>
            </div>
          </div>

          {/* Owner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-4">Propietario</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-lg font-bold flex-shrink-0">
                {vehicle.owner?.name?.[0]}{vehicle.owner?.lastName?.[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white">{vehicle.owner?.name} {vehicle.owner?.lastName}</p>
                  {vehicle.owner?.identityVerified && (
                    <BadgeCheck size={16} className="text-indigo-400" />
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Score {vehicle.owner?.driverScore} · {vehicle.owner?.totalTrips} viajes
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-500">Miembro desde</p>
                <p className="text-xs text-slate-400">
                  {vehicle.owner?.createdAt ? new Date(vehicle.owner.createdAt).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' }) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Reviews */}
          {vehicle.reviews?.length > 0 && (
            <div>
              <h3 className="font-semibold text-white mb-4">Reseñas recientes</h3>
              <div className="space-y-4">
                {vehicle.reviews.map((r: any) => (
                  <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                          {r.author?.name?.[0]}
                        </div>
                        <span className="text-sm font-medium text-white">{r.author?.name} {r.author?.lastName}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={12} className={i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-slate-400">{r.comment}</p>}
                    <p className="text-xs text-slate-600 mt-2">{new Date(r.createdAt).toLocaleDateString('es-EC')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — Booking widget */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            {/* Price */}
            <div>
              <span className="text-3xl font-bold text-white">${Number(vehicle.pricePerDay).toFixed(0)}</span>
              <span className="text-slate-400 text-sm">/día</span>
              {vehicle.pricePerHour && (
                <p className="text-xs text-slate-500 mt-0.5">${Number(vehicle.pricePerHour).toFixed(0)}/hora</p>
              )}
            </div>

            {!isOwner && (
              <>
                {/* Date pickers — Check-in / Check-out como hoteles */}
                <div className="space-y-3">
                  {/* Check-in */}
                  <div>
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      🏁 Check-in
                      <span className="text-indigo-400 font-normal normal-case">selecciona fecha</span>
                    </label>
                    <input type="date"
                      value={startDate}
                      min={todayStr}
                      onChange={e => handleStartDateChange(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <p className="text-xs text-slate-500 mt-1 ml-1">
                      Disponible desde las <span className="text-indigo-400 font-medium">14:00</span>
                    </p>
                  </div>

                  {/* Check-out */}
                  <div>
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      🏁 Check-out
                      <span className="text-indigo-400 font-normal normal-case">selecciona fecha</span>
                    </label>
                    <input type="date"
                      value={endDate}
                      min={minEndDate}
                      onChange={e => handleEndDateChange(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <p className="text-xs text-slate-500 mt-1 ml-1">
                      Debes devolverlo antes de las <span className="text-indigo-400 font-medium">12:00</span>
                    </p>
                  </div>

                  {/* Resumen de fechas */}
                  {startDate && endDate && (
                    <div className="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/50">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Inicio</span>
                        <span className="text-white font-medium">{formatDateLong(startDate)} · 14:00</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-1.5">
                        <span>Fin</span>
                        <span className="text-white font-medium">{formatDateLong(endDate)} · 12:00</span>
                      </div>
                      <div className="border-t border-slate-700/50 mt-2 pt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Duración</span>
                        <span className="text-white font-medium">
                          {nights} día{nights !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Price breakdown */}
                {startDate && endDate && nights > 0 && (
                  <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-300">
                      <span>${Number(vehicle.pricePerDay).toFixed(0)} × {nights} día{nights !== 1 ? 's' : ''}</span>
                      <span>${(nights * Number(vehicle.pricePerDay)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Comisión plataforma (15%)</span>
                      <span>${(nights * Number(vehicle.pricePerDay) * 0.15).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-white border-t border-slate-700 pt-2">
                      <span>Total</span>
                      <span>${(nights * Number(vehicle.pricePerDay) * 1.15).toFixed(2)}</span>
                    </div>
                    {Number(vehicle.deposit) > 0 && (
                      <p className="text-xs text-slate-500">
                        + ${Number(vehicle.deposit).toFixed(2)} depósito (reembolsable)
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleBook}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors text-sm"
                >
                  {user ? 'Reservar ahora' : 'Iniciar sesión para reservar'}
                </button>

                {vehicle.withDriver && (
                  <p className="text-xs text-center text-slate-500">
                    Disponible con chofer (+${Number(vehicle.driverPrice ?? 0).toFixed(0)}/día)
                  </p>
                )}
              </>
            )}

            {isOwner && (
              <div className="text-center py-4">
                <p className="text-sm text-slate-400 mb-3">Este es tu vehículo</p>
                <button
                  onClick={() => navigate(`/dashboard`)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Gestionar vehículo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
