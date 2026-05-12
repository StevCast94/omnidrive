import { useState, useEffect } from 'react';
import { User, BadgeCheck, Star, Car, Shield, Zap, Upload, Plus, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth as authApi, vehicles as vehiclesApi, subscriptions as subsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PhoneInput } from '@/components/PhoneInput';

const TABS = ['Perfil', 'Vehículos', 'Verificación', 'Suscripción'] as const;
type Tab = typeof TABS[number];

export default function Profile() {
  const { user, updateUser } = useAuthStore();

  // Parse query params manually (no react-router-dom dependency)
  useEffect(() => {
    const qp = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
    if (qp.get('tab') === 'vehicle') setTab('Vehículos');
  }, []);
  const [tab, setTab] = useState<Tab>('Perfil');
  const [myVehicles, setMyVehicles] = useState<any[]>([]);
  const [plans, setPlans] = useState<any>(null);
  const [form, setForm] = useState({ name: user?.name ?? '', lastName: user?.lastName ?? '', phone: user?.phone ?? '', gender: '' });
  const [vehicleForm, setVehicleForm] = useState({
    brand: '', model: '', year: '', plate: '', color: '', vin: '',
    category: 'car', seats: '5', transmission: 'automatic', fuelType: 'gasoline',
    pricePerHour: '', pricePerDay: '', deposit: '', locationName: '',
    withDriver: false, insurance: false, features: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);

  useEffect(() => {
    const qp = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
    if (qp.get('tab') === 'vehicle') setTab('Vehículos');
  }, []);

  useEffect(() => {
    if (tab === 'Vehículos') {
      vehiclesApi.list().then(r => setMyVehicles(r.data.data.filter((v: any) => v.ownerId === user?.id)));
    }
    if (tab === 'Suscripción') {
      subsApi.plans().then(r => setPlans(r.data.data));
    }
  }, [tab]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data: res } = await authApi.updateMe(form);
      updateUser(res.data);
      toast.success('Perfil actualizado');
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const verifyIdentity = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    // Handled via multipart — simplified for MVP
    toast('Funcionalidad de verificación disponible via API');
  };

  const createVehicle = async () => {
    setSaving(true);
    try {
      await vehiclesApi.create(vehicleForm);
      toast.success('¡Vehículo publicado!');
      setShowVehicleForm(false);
      const r = await vehiclesApi.list();
      setMyVehicles(r.data.data.filter((v: any) => v.ownerId === user?.id));
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al publicar');
    } finally { setSaving(false); }
  };

  const subscribe = async (tier: string, interval: string) => {
    setSaving(true);
    try {
      await subsApi.subscribe({ tier, interval });
      toast.success(`¡Suscripción ${tier} activada!`);
      updateUser({ subscriptionTier: tier as any });
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al suscribirse');
    } finally { setSaving(false); }
  };

  const cancelSub = async () => {
    if (!confirm('¿Cancelar suscripción?')) return;
    try {
      await subsApi.cancel();
      toast.success('Suscripción cancelada');
      updateUser({ subscriptionTier: 'free' });
    } catch { toast.error('Error al cancelar'); }
  };

  const vSet = (k: string, v: any) => setVehicleForm(f => ({ ...f, [k]: v }));

  const FEATURES = ['ac', 'gps', 'bluetooth', 'usb', 'backup_camera', 'sunroof', 'leather'];
  const FEATURE_LABELS: Record<string, string> = {
    ac: 'Aire acondicionado', gps: 'GPS', bluetooth: 'Bluetooth',
    usb: 'USB', backup_camera: 'Cámara trasera', sunroof: 'Techo solar', leather: 'Cuero',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-2xl font-bold">
          {user?.name?.[0]}{user?.lastName?.[0]}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{user?.name} {user?.lastName}</h1>
            {user?.identityVerified && <BadgeCheck size={18} className="text-indigo-400" />}
          </div>
          <p className="text-sm text-slate-400">{user?.email}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Star size={11} /> Score {user?.driverScore}
            </span>
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-slate-500">{user?.totalTrips} viajes</span>
            <span className="text-xs text-slate-600">·</span>
            <span className={`text-xs font-medium capitalize ${user?.subscriptionTier === 'free' ? 'text-slate-400' : user?.subscriptionTier === 'premium' ? 'text-yellow-400' : 'text-violet-400'}`}>
              {user?.subscriptionTier}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── PERFIL ── */}
      {tab === 'Perfil' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h3 className="font-semibold text-white">Información personal</h3>
          <div className="grid grid-cols-2 gap-4">
            {[['Nombre', 'name'], ['Apellido', 'lastName']].map(([l, k]) => (
              <div key={k}>
                <label className="block text-xs text-slate-400 mb-1.5">{l}</label>
                <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            ))}
          </div>
          <div>
            <PhoneInput
              value={form.phone}
              onChange={v => setForm(f => ({ ...f, phone: v }))}
              placeholder="99 000 0000"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Género</label>
            <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Prefiero no decir</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="flex items-center gap-3 py-3 px-4 bg-slate-800 rounded-xl text-sm">
            <span className="text-slate-400">Documento:</span>
            <span className="text-white font-medium">{user?.documentType === 'cedula' ? 'Cédula' : 'Pasaporte'} · {user?.documentId ?? '—'}</span>
            {user?.identityVerified && <BadgeCheck size={14} className="text-indigo-400 ml-auto" />}
          </div>
          <button onClick={saveProfile} disabled={saving}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* ── VEHÍCULOS ── */}
      {tab === 'Vehículos' && (
        <div className="space-y-4">
          {!showVehicleForm ? (
            <>
              {myVehicles.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Car size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No tienes vehículos publicados</p>
                </div>
              )}
              {myVehicles.map(v => (
                <div key={v.id} className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="w-14 h-14 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0">
                    {v.photos?.[0] ? <img src={v.photos[0]} className="w-full h-full object-cover" alt="" />
                      : <div className="w-full h-full flex items-center justify-center"><Car size={20} className="text-slate-600" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{v.brand} {v.model} {v.year}</p>
                    <p className="text-xs text-slate-500">{v.plate} · {v.category}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${v.available ? 'text-green-400 border-green-500/20 bg-green-500/10' : 'text-slate-500 border-slate-700 bg-slate-800'}`}>
                        {v.available ? 'Disponible' : 'No disponible'}
                      </span>
                      <span className="text-xs text-slate-400">${Number(v.pricePerDay).toFixed(0)}/día</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-600 flex-shrink-0" />
                </div>
              ))}
              <button onClick={() => {
                if (!user?.identityVerified) return toast.error('Debes verificar tu identidad primero');
                setShowVehicleForm(true);
              }}
                className="w-full py-3.5 border-2 border-dashed border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-white rounded-2xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Plus size={16} /> Publicar nuevo vehículo
              </button>
            </>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Nuevo vehículo</h3>
                <button onClick={() => setShowVehicleForm(false)} className="text-slate-500 hover:text-white text-sm">Cancelar</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[['Marca', 'brand', 'Toyota'], ['Modelo', 'model', 'Corolla'], ['Año', 'year', '2022'], ['Placa', 'plate', 'ABC-1234'], ['Color', 'color', 'Blanco'], ['VIN/Chasis', 'vin', '']].map(([l, k, ph]) => (
                  <div key={k}>
                    <label className="block text-xs text-slate-400 mb-1">{l}</label>
                    <input value={(vehicleForm as any)[k]} onChange={e => vSet(k, e.target.value)} placeholder={ph}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Categoría</label>
                  <select value={vehicleForm.category} onChange={e => vSet('category', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {['car', 'suv', 'motorcycle', 'van', 'truck', 'luxury'].map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Asientos</label>
                  <input type="number" value={vehicleForm.seats} onChange={e => vSet('seats', e.target.value)} min="1" max="20"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Transmisión</label>
                  <select value={vehicleForm.transmission} onChange={e => vSet('transmission', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="automatic">Automático</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Combustible</label>
                  <select value={vehicleForm.fuelType} onChange={e => vSet('fuelType', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {['gasoline', 'diesel', 'electric', 'hybrid'].map(f => <option key={f} value={f} className="capitalize">{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[['Precio/hora ($)', 'pricePerHour'], ['Precio/día ($)', 'pricePerDay'], ['Depósito ($)', 'deposit']].map(([l, k]) => (
                  <div key={k}>
                    <label className="block text-xs text-slate-400 mb-1">{l}</label>
                    <input type="number" step="0.01" value={(vehicleForm as any)[k]} onChange={e => vSet(k, e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Ubicación / sector</label>
                <input value={vehicleForm.locationName} onChange={e => vSet('locationName', e.target.value)} placeholder="Ej: Norte de Quito, La Carolina"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {/* Features */}
              <div>
                <label className="block text-xs text-slate-400 mb-2">Características</label>
                <div className="flex flex-wrap gap-2">
                  {FEATURES.map(f => {
                    const active = vehicleForm.features.includes(f);
                    return (
                      <button key={f} type="button"
                        onClick={() => vSet('features', active ? vehicleForm.features.filter(x => x !== f) : [...vehicleForm.features, f])}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${active ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                        {FEATURE_LABELS[f]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                {[['Ofrecer con chofer', 'withDriver'], ['Tiene seguro (SOAT/privado)', 'insurance']].map(([l, k]) => (
                  <label key={k} className="flex items-center gap-3 cursor-pointer py-2.5 px-4 bg-slate-800 rounded-xl">
                    <input type="checkbox" checked={(vehicleForm as any)[k]} onChange={e => vSet(k, e.target.checked)} className="accent-indigo-500 w-4 h-4" />
                    <span className="text-sm text-slate-300">{l}</span>
                  </label>
                ))}
              </div>

              <button onClick={createVehicle} disabled={saving || !vehicleForm.brand || !vehicleForm.plate || !vehicleForm.pricePerDay}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
                {saving ? 'Publicando...' : 'Publicar vehículo'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── VERIFICACIÓN ── */}
      {tab === 'Verificación' && (
        <div className="space-y-4">
          <div className={`rounded-2xl p-5 border flex items-start gap-4 ${user?.identityVerified ? 'bg-green-500/5 border-green-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
            <Shield size={22} className={user?.identityVerified ? 'text-green-400 mt-0.5' : 'text-yellow-400 mt-0.5'} />
            <div>
              <p className="font-semibold text-white">{user?.identityVerified ? '✅ Identidad verificada' : '⏳ Pendiente de verificación'}</p>
              <p className="text-sm text-slate-400 mt-1">
                {user?.identityVerified
                  ? 'Tu identidad fue verificada. Puedes publicar vehículos y hacer reservas.'
                  : 'Sube tus documentos para verificar tu identidad y acceder a todas las funciones.'}
              </p>
            </div>
          </div>

          {!user?.identityVerified && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-white">Subir documentos</h3>
              <p className="text-sm text-slate-400">Para verificar tu identidad necesitas subir los siguientes documentos. Un administrador los revisará en 24-48 horas.</p>

              {[
                { label: 'Selfie (foto tuya sosteniendo tu documento)', key: 'selfie' },
                { label: 'Cédula/Pasaporte — Frente', key: 'documentFront' },
                { label: 'Cédula/Pasaporte — Reverso', key: 'documentBack' },
              ].map(item => (
                <div key={item.key} className="flex items-center gap-3 bg-slate-800 rounded-xl p-4">
                  <Upload size={16} className="text-slate-500 flex-shrink-0" />
                  <p className="text-sm text-slate-300 flex-1">{item.label}</p>
                  <label className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                    Subir
                    <input type="file" accept="image/*" className="hidden" onChange={e => verifyIdentity(e, item.key)} />
                  </label>
                </div>
              ))}
              <p className="text-xs text-slate-500">En el MVP, la verificación se hace manualmente desde el panel de administración.</p>
            </div>
          )}
        </div>
      )}

      {/* ── SUSCRIPCIÓN ── */}
      {tab === 'Suscripción' && (
        <div className="space-y-4">
          {/* Current plan */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-sm text-slate-400 mb-1">Plan actual</p>
            <p className="text-xl font-bold text-white capitalize">{user?.subscriptionTier === 'free' ? 'Free' : user?.subscriptionTier === 'premium' ? 'Premium ⭐' : 'Elite 💎'}</p>
            {user?.subscriptionTier !== 'free' && (
              <button onClick={cancelSub} className="mt-3 text-xs text-red-400 hover:text-red-300 transition-colors">Cancelar suscripción</button>
            )}
          </div>

          {/* Plans */}
          {plans && Object.entries(plans).map(([tier, p]: any) => {
            const isCurrent = user?.subscriptionTier === tier;
            return (
              <div key={tier} className={`bg-slate-900 border rounded-2xl p-6 space-y-4 ${isCurrent ? 'border-indigo-500' : 'border-slate-800'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap size={18} className={tier === 'elite' ? 'text-violet-400' : 'text-yellow-400'} />
                      <h3 className="font-bold text-white text-lg capitalize">{tier}</h3>
                      {isCurrent && <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">Activo</span>}
                    </div>
                    <p className="text-slate-400 text-sm">${p.monthly.price}/mes · ${p.yearly.price}/año</p>
                  </div>
                  {!isCurrent && (
                    <button onClick={() => subscribe(tier, 'monthly')} disabled={saving}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
                      {saving ? '...' : 'Suscribirse'}
                    </button>
                  )}
                </div>
                <ul className="space-y-2">
                  {p.benefits.map((b: string) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span> {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
