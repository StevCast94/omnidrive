import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from '@/lib/router-exports';
import { Plus, Car, Calendar, Clock, CheckCircle, XCircle, AlertTriangle, ChevronRight, Star } from 'lucide-react';
import { bookings as bookingsApi, vehicles as vehiclesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import VehicleCard from '@/components/VehicleCard';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: 'Pendiente',  color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: Clock },
  confirmed: { label: 'Confirmada', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',   icon: CheckCircle },
  active:    { label: 'En curso',   color: 'text-green-400 bg-green-400/10 border-green-400/20', icon: Car },
  completed: { label: 'Completada', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20', icon: CheckCircle },
  cancelled: { label: 'Cancelada',  color: 'text-red-400 bg-red-400/10 border-red-400/20',       icon: XCircle },
  disputed:  { label: 'Disputa',    color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', icon: AlertTriangle },
};

function BookingRow({ b, onClick }: { b: any; onClick: () => void }) {
  const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <div onClick={onClick}
      className="flex items-center gap-4 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-4 cursor-pointer transition-all group">
      <div className="w-14 h-14 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0">
        {b.vehicle?.photos?.[0]
          ? <img src={b.vehicle.photos[0]} className="w-full h-full object-cover" alt="" />
          : <div className="w-full h-full flex items-center justify-center"><Car size={20} className="text-slate-600" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm truncate">{b.vehicle?.brand} {b.vehicle?.model} {b.vehicle?.year}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {new Date(b.startAt).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })} �{' '}
          {new Date(b.endAt).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <p className="text-xs text-slate-400 mt-0.5 font-medium">${Number(b.totalAmount).toFixed(2)}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
          <Icon size={11} /> {cfg.label}
        </span>
        <ChevronRight size={16} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'tenant' | 'owner' | 'vehicles'>('tenant');
  const [tenantBookings, setTenantBookings] = useState<any[]>([]);
  const [ownerBookings, setOwnerBookings] = useState<any[]>([]);
  const [myVehicles, setMyVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      bookingsApi.list({ role: 'tenant' }),
      bookingsApi.list({ role: 'owner' }),
      vehiclesApi.list(),
    ]).then(([tb, ob, vb]) => {
      setTenantBookings(tb.data.data);
      setOwnerBookings(ob.data.data);
      // filter only own vehicles
      setMyVehicles(vb.data.data.filter((v: any) => v.ownerId === user?.id));
    }).catch(() => toast.error('Error al cargar el dashboard'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const tabs = [
    { id: 'tenant', label: 'Mis alquileres', count: tenantBookings.length },
    { id: 'owner', label: 'Solicitudes recibidas', count: ownerBookings.length },
    { id: 'vehicles', label: 'Mis veh�culos', count: myVehicles.length },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Hola, {user?.name} ??</p>
        </div>
        <button onClick={() => navigate('/profile?tab=vehicle')}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Publicar veh�culo
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-xl font-bold text-white">{user?.totalTrips ?? 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">Viajes realizados</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            {user?.rating != null && user.rating > 0 ? (
              <>
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={14} className={s <= Math.round(user.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'} />
                ))}
                <span className="text-white font-bold ml-1 text-sm">{user.rating.toFixed(1)}</span>
              </>
            ) : (
              <span className="text-sm text-slate-500">Sin calificaciones</span>
            )}
          </div>
          <p className="text-xs text-slate-500">Calificación</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${tab === t.id ? 'bg-white/20' : 'bg-slate-700'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-900 rounded-2xl animate-pulse border border-slate-800" />)}
        </div>
      ) : (
        <>
          {/* Tenant bookings */}
          {tab === 'tenant' && (
            <div className="space-y-3">
              {tenantBookings.length === 0 ? (
                <Empty text="A�n no has realizado ninguna reserva" action={() => navigate('/vehicles')} actionLabel="Explorar veh�culos" />
              ) : tenantBookings.map(b => (
                <BookingRow key={b.id} b={b} onClick={() => navigate(`/bookings/${b.id}`)} />
              ))}
            </div>
          )}

          {/* Owner bookings */}
          {tab === 'owner' && (
            <div className="space-y-3">
              {ownerBookings.length === 0 ? (
                <Empty text="No has recibido solicitudes a�n" action={() => navigate('/profile?tab=vehicle')} actionLabel="Publicar un veh�culo" />
              ) : ownerBookings.map(b => (
                <BookingRow key={b.id} b={b} onClick={() => navigate(`/bookings/${b.id}`)} />
              ))}
            </div>
          )}

          {/* My vehicles */}
          {tab === 'vehicles' && (
            <div>
              {myVehicles.length === 0 ? (
                <Empty text="A�n no tienes veh�culos publicados" action={() => navigate('/profile?tab=vehicle')} actionLabel="Publicar veh�culo" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {myVehicles.map(v => <VehicleCard key={v.id} vehicle={v} onClick={() => navigate('/profile?tab=vehicle')} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Empty({ text, action, actionLabel }: { text: string; action: () => void; actionLabel: string }) {
  return (
    <div className="text-center py-16 space-y-4">
      <Calendar size={48} className="mx-auto text-slate-700" />
      <p className="text-slate-400">{text}</p>
      <button onClick={action}
        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors">
        {actionLabel}
      </button>
    </div>
  );
}

