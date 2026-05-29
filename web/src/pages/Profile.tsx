import { useState, useEffect, useRef } from 'react';
import { User, BadgeCheck, Star, Car, Shield, Upload, Plus, ChevronRight, ScanFace, CheckCircle, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth as authApi, vehicles as vehiclesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PhoneInput } from '@/components/PhoneInput';
import VerificationModal from '@/components/VerificationModal';

const TABS = ['Perfil', 'Vehículos', 'Verificación'] as const;
type Tab = typeof TABS[number];

export default function Profile() {
  const { user, updateUser } = useAuthStore();

  // Parse query params manually (no react-router-dom dependency)
  useEffect(() => {
    const qp = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
    if (qp.get('tab') === 'vehicle') setTab('Vehículos');
    if (qp.get('tab') === 'verificacion') setTab('Verificación');
  }, []);
  const [tab, setTab] = useState<Tab>('Perfil');
  const [myVehicles, setMyVehicles] = useState<any[]>([]);
  const [plans, setPlans] = useState<any>(null);
  const [form, setForm] = useState({
    name: user?.name ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    gender: user?.gender ?? '',
    birthDate: '',
    documentType: user?.documentType ?? 'cedula',
    documentId: user?.documentId ?? '',
  });
  const [vehicleForm, setVehicleForm] = useState({
    brand: '', model: '', year: '', plate: '', color: '', vin: '',
    category: 'car', seats: '5', transmission: 'automatic', fuelType: 'gasoline',
    pricePerHour: '', pricePerDay: '', deposit: '', locationName: '',
    withDriver: false, insurance: false, flexibleCheckin: true,
    checkInTime: '', checkOutTime: '',
    features: [] as string[],
  });
  const [customFeature, setCustomFeature] = useState('');
  const [saving, setSaving] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleFormPhotos, setVehicleFormPhotos] = useState<File[]>([]);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [showVerification, setShowVerification] = useState(false);

  // Birth date: 3 selects (año → mes → día condicionado)
  const userBirth = user?.birthDate ? new Date(user.birthDate) : null;
  const [birthDay, setBirthDay] = useState({
    year: userBirth ? String(userBirth.getFullYear()) : '',
    month: userBirth ? String(userBirth.getMonth() + 1).padStart(2, '0') : '',
    day: userBirth ? String(userBirth.getDate()).padStart(2, '0') : '',
  });
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const selectedYear = parseInt(birthDay.year) || 0;
  const selectedMonth = parseInt(birthDay.month) || 0;
  const daysInMonth = selectedYear && selectedMonth
    ? new Date(selectedYear, selectedMonth, 0).getDate()
    : 31;
  const currentDay = parseInt(birthDay.day) || 0;
  const validDay = currentDay > daysInMonth ? '' : birthDay.day;
  const setBirthDate = (y: string | undefined, m: string | undefined, d: string | undefined) => {
    const ny = y !== undefined ? y : birthDay.year;
    const nm = m !== undefined ? m : birthDay.month;
    const nd = d !== undefined ? d : birthDay.day;
    setBirthDay({ year: ny, month: nm, day: nd });
    const yi = parseInt(ny) || 0;
    const mi = parseInt(nm) || 0;
    const maxD = yi && mi ? new Date(yi, mi, 0).getDate() : 31;
    const di = parseInt(nd) || 0;
    const finalDay = di > maxD ? '' : nd;
    if (ny && nm && finalDay) {
      const date = new Date(yi, mi - 1, parseInt(finalDay));
      if (!isNaN(date.getTime())) {
        setForm(f => ({ ...f, birthDate: date.toISOString().split('T')[0] }));
      }
    }
  };

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
      const formData = { ...vehicleForm };
      if (editingVehicle) {
        await vehiclesApi.update(editingVehicle.id, formData);
        // Subir fotos adicionales
        if (vehicleFormPhotos.length > 0) {
          const fd = new FormData();
          vehicleFormPhotos.forEach(f => fd.append('photos', f));
          await vehiclesApi.uploadPhotos(editingVehicle.id, fd);
        }
        toast.success('¡Vehículo actualizado!');
      } else {
        const res = await vehiclesApi.create(formData);
        const vehicleId = res.data.data.id;
        if (vehicleFormPhotos.length > 0) {
          const fd = new FormData();
          vehicleFormPhotos.forEach(f => fd.append('photos', f));
          await vehiclesApi.uploadPhotos(vehicleId, fd);
        }
        toast.success('¡Vehículo publicado!');
      }
      setShowVehicleForm(false);
      setEditingVehicle(null);
      setVehicleFormPhotos([]);
      const r = await vehiclesApi.list();
      setMyVehicles(r.data.data.filter((v: any) => v.ownerId === user?.id));
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error');
    } finally { setSaving(false); }
  };

  const editVehicle = (v: any) => {
    setVehicleForm({
      brand: v.brand || '', model: v.model || '', year: String(v.year || ''), plate: v.plate || '',
      color: v.color || '', vin: v.vin || '', category: v.category || 'car',
      seats: String(v.seats || '5'), transmission: v.transmission || 'automatic',
      fuelType: v.fuelType || 'gasoline', pricePerHour: String(v.pricePerHour || ''),
      pricePerDay: String(v.pricePerDay || ''), deposit: String(v.deposit || ''),
      locationName: v.locationName || '', withDriver: v.withDriver || false,
      insurance: v.insurance || false,
      features: v.features || [],
      flexibleCheckin: v.flexibleCheckin !== undefined ? v.flexibleCheckin : false,
      checkInTime: v.checkInTime || '',
      checkOutTime: v.checkOutTime || '',
    });
    setVehicleFormPhotos([]);
    setEditingVehicle(v);
    setShowVehicleForm(true);
  };

  const toggleAvailability = async (v: any) => {
    try {
      await vehiclesApi.setAvailability(v.id, !v.available);
      toast.success(v.available ? 'Vehículo no disponible' : 'Vehículo disponible');
      const r = await vehiclesApi.list();
      setMyVehicles(r.data.data.filter((x: any) => x.ownerId === user?.id));
    } catch { toast.error('Error'); }
  };

  const deleteVehicle = async (v: any) => {
    if (!confirm(`¿Eliminar ${v.brand} ${v.model} ${v.year}?`)) return;
    try {
      await vehiclesApi.delete(v.id);
      toast.success('Vehículo eliminado');
      const r = await vehiclesApi.list();
      setMyVehicles(r.data.data.filter((x: any) => x.ownerId === user?.id));
    } catch { toast.error('Error'); }
  };

  const vSet = (k: string, v: any) => setVehicleForm(f => ({ ...f, [k]: v }));

  const FEATURES = ['ac', 'gps', 'bluetooth', 'usb', 'backup_camera', 'sunroof', 'leather'];
  const FEATURE_LABELS: Record<string, string> = {
    ac: 'Aire acondicionado', gps: 'GPS', bluetooth: 'Bluetooth',
    usb: 'USB', backup_camera: 'Cámara trasera', sunroof: 'Techo solar', leather: 'Cuero',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header con avatar */}
      <div className="flex items-center gap-4">
        <div className="relative group">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-white">
                {user?.name?.[0] || '?'}{user?.lastName?.[0] || ''}
              </span>
            )}
          </div>
          <button
            onClick={() => document.getElementById('avatar-input')?.click()}
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-800 border border-slate-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-slate-700"
            title="Cambiar foto"
          >
            <Camera size={12} className="text-slate-300" />
          </button>
          <input
            id="avatar-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                toast.error('La imagen no puede superar 5MB');
                return;
              }
              try {
                const formData = new FormData();
                formData.append('avatar', file);
                const token = (await import('@/lib/api')).api.defaults.headers?.Authorization || '';
                const { data: res } = await (await import('@/lib/api')).api.post('/auth/avatar', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
                if (res?.data?.avatarUrl) {
                  updateUser({ avatarUrl: res.data.avatarUrl });
                  toast.success('Foto de perfil actualizada');
                }
              } catch { toast.error('Error al subir la imagen'); }
            }}
          />
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
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Fecha de nacimiento</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={birthDay.year}
                onChange={e => setBirthDate(e.target.value, undefined, undefined)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                <option value="">Año</option>
                {years.map(y => (<option key={y} value={y}>{y}</option>))}
              </select>
              <select
                value={birthDay.month}
                onChange={e => setBirthDate(undefined, e.target.value, undefined)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                <option value="">Mes</option>
                {[
                  { v: '01', l: 'Ene' }, { v: '02', l: 'Feb' }, { v: '03', l: 'Mar' },
                  { v: '04', l: 'Abr' }, { v: '05', l: 'May' }, { v: '06', l: 'Jun' },
                  { v: '07', l: 'Jul' }, { v: '08', l: 'Ago' }, { v: '09', l: 'Sep' },
                  { v: '10', l: 'Oct' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dic' },
                ].map(m => (<option key={m.v} value={m.v}>{m.l}</option>))}
              </select>
              <select
                value={validDay}
                onChange={e => setBirthDate(undefined, undefined, e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                <option value="">Día</option>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d.toString().padStart(2, '0')}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Tipo de documento</label>
              <select value={form.documentType || 'cedula'} onChange={e => setForm(f => ({ ...f, documentType: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="cedula">Cédula</option>
                <option value="pasaporte">Pasaporte</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Número de documento</label>
              <input value={form.documentId || ''} onChange={e => setForm(f => ({ ...f, documentId: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ingresa tu número de documento" />
            </div>
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
                <div key={v.id} className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-slate-700 transition-colors" onClick={() => editVehicle(v)}>
                  <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0">
                    {v.photos?.[0] ? <img src={v.photos[0]} className="w-full h-full object-cover" alt="" />
                      : <div className="w-full h-full flex items-center justify-center"><Car size={20} className="text-slate-600" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{v.brand} {v.model} {v.year}</p>
                    <p className="text-xs text-slate-500">{v.plate} · {v.category}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={e => { e.stopPropagation(); toggleAvailability(v); }}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${v.available ? 'text-green-400 border-green-500/20 bg-green-500/10 hover:bg-green-500/20' : 'text-slate-400 border-slate-700 bg-slate-800 hover:bg-slate-700'}`}>
                        {v.available ? 'Disponible' : 'No disponible'}
                      </button>
                      <span className="text-xs text-slate-400">${Number(v.pricePerDay).toFixed(0)}/día</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button onClick={e => { e.stopPropagation(); editVehicle(v); }} className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg hover:bg-indigo-500/20">
                      Editar
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteVehicle(v); }} className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-lg hover:bg-red-500/20">
                      Eliminar
                    </button>
                  </div>
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
                <h3 className="font-semibold text-white">{editingVehicle ? 'Editar vehículo' : 'Nuevo vehículo'}</h3>
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

              {/* FOTOS */}
              <div>
                <label className="block text-xs text-slate-400 mb-2">Fotos del vehículo (mín. 4: frente, atrás, laterales)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map(i => (
                    <label key={i} className="aspect-[4/3] bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors">
                      {vehicleFormPhotos[i] ? (
                        <div className="relative w-full h-full">
                          <img src={URL.createObjectURL(vehicleFormPhotos[i])} className="w-full h-full object-cover rounded-xl" alt="" />
                          <button type="button" onClick={() => { const c = [...vehicleFormPhotos]; c.splice(i, 1); setVehicleFormPhotos(c); }}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-500">
                          <Camera size={20} />
                          <span className="text-xs">Foto {i + 1}</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { const c = [...vehicleFormPhotos]; c[i] = f; setVehicleFormPhotos(c); } }} />
                    </label>
                  ))}
                </div>
                {editingVehicle && (
                  <p className="text-xs text-slate-500 mt-1">(Las fotos existentes se conservan, solo se agregan nuevas)</p>
                )}
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
                  {/* Custom features already added */}
                  {vehicleForm.features.filter(f => !FEATURES.includes(f)).map(f => (
                    <button key={f} type="button"
                      onClick={() => vSet('features', vehicleForm.features.filter(x => x !== f))}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium border bg-indigo-600 border-indigo-500 text-white flex items-center gap-1">
                      {f}
                      <span className="text-indigo-300">×</span>
                    </button>
                  ))}
                </div>
                {/* Add custom feature */}
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={customFeature}
                    onChange={e => setCustomFeature(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && customFeature.trim()) {
                        e.preventDefault();
                        const feat = customFeature.trim();
                        if (!vehicleForm.features.includes(feat)) {
                          vSet('features', [...vehicleForm.features, feat]);
                        }
                        setCustomFeature('');
                      }
                    }}
                    placeholder="Ej: sensor de parqueo, cámara 360°..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const feat = customFeature.trim();
                      if (!feat || vehicleForm.features.includes(feat)) return;
                      vSet('features', [...vehicleForm.features, feat]);
                      setCustomFeature('');
                    }}
                    disabled={!customFeature.trim()}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-xl text-xs font-medium text-white transition-colors"
                  >
                    + Añadir
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                {/* Horario flexible */}
                <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={vehicleForm.flexibleCheckin} onChange={e => {
                      const val = e.target.checked;
                      vSet('flexibleCheckin', val);
                      if (!val) {
                        // Pre-llenar con defaults si están vacíos
                        if (!vehicleForm.checkInTime) vSet('checkInTime', '14:00');
                        if (!vehicleForm.checkOutTime) vSet('checkOutTime', '12:00');
                      }
                    }} className="accent-indigo-500 w-4 h-4" />
                    <div>
                      <span className="text-sm text-slate-300">Horario flexible / A libre acuerdo</span>
                      <p className="text-xs text-slate-500">Check-in y check-out se coordinan entre las partes en los pasos previos a la entrega</p>
                    </div>
                  </label>
                  {!vehicleForm.flexibleCheckin && (
                    <div className="grid grid-cols-2 gap-3 pl-7">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Hora de check-in</label>
                        <input
                          type="time"
                          value={vehicleForm.checkInTime}
                          onChange={e => vSet('checkInTime', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Hora de check-out</label>
                        <input
                          type="time"
                          value={vehicleForm.checkOutTime}
                          onChange={e => vSet('checkOutTime', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-3 cursor-pointer py-2.5 px-4 bg-slate-800 rounded-xl">
                  <input type="checkbox" checked={vehicleForm.withDriver} onChange={e => vSet('withDriver', e.target.checked)} className="accent-indigo-500 w-4 h-4" />
                  <span className="text-sm text-slate-300">Ofrecer con chofer</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer py-2.5 px-4 bg-slate-800 rounded-xl">
                  <input type="checkbox" checked={vehicleForm.insurance} onChange={e => vSet('insurance', e.target.checked)} className="accent-indigo-500 w-4 h-4" />
                  <span className="text-sm text-slate-300">Tiene seguro (SOAT/privado)</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setShowVehicleForm(false); setEditingVehicle(null); setVehicleFormPhotos([]); }} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-slate-300 transition-colors">
                  Cancelar
                </button>
                <button onClick={createVehicle} disabled={saving || !vehicleForm.brand || !vehicleForm.plate || !vehicleForm.pricePerDay}
                  className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
                  {saving ? 'Guardando...' : editingVehicle ? 'Guardar cambios' : 'Publicar vehículo'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

        {/* ── VERIFICACIÓN ── */}
      {tab === 'Verificación' && (
        <div className="space-y-4">

          {/* Rechazada */}
          {user?.verificationNotes && !user?.identityVerified && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 flex items-start gap-4">
              <Shield size={22} className="mt-0.5 text-red-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-400">❌ Verificación rechazada</p>
                <p className="text-sm text-slate-400 mt-1"><strong>Motivo:</strong> {user.verificationNotes}</p>
                <p className="text-xs text-slate-500 mt-2">Corrige los datos según la observación y vuelve a subir tus documentos.</p>
                <button onClick={() => setShowVerification(true)}
                  className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors">
                  Reintentar verificación
                </button>
              </div>
            </div>
          )}

          <div className={`rounded-2xl p-5 border flex items-start gap-4 ${
            user?.verificationNotes && !user?.identityVerified
              ? 'bg-red-500/5 border-red-500/20'
              : user?.identityVerified
              ? 'bg-green-500/5 border-green-500/20'
              : user?.selfieUrl
              ? 'bg-blue-500/5 border-blue-500/20'
              : 'bg-yellow-500/5 border-yellow-500/20'
          }`}>
            <Shield size={22} className={`mt-0.5 ${
              user?.verificationNotes && !user?.identityVerified ? 'text-red-400'
              : user?.identityVerified ? 'text-green-400'
              : user?.selfieUrl ? 'text-blue-400'
              : 'text-yellow-400'
            }`} />
            <div>
              <p className="font-semibold text-white">
                {user?.verificationNotes && !user?.identityVerified
                  ? '❌ Verificación rechazada'
                  : user?.identityVerified
                  ? '✅ Identidad verificada'
                  : user?.selfieUrl
                  ? '📄 Documentos recibidos'
                  : '⏳ Verificación pendiente'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {user?.verificationNotes && !user?.identityVerified
                  ? 'Tu verificación fue rechazada. Revisa el motivo arriba y vuelve a subir tus documentos.'
                  : user?.identityVerified
                  ? 'Tu identidad fue verificada exitosamente. Ya puedes publicar vehículos y alquilar con confianza.'
                  : user?.selfieUrl
                  ? 'Tus documentos han sido recibidos. Nuestro equipo los revisará y te notificaremos cuando esté listo.'
                  : 'Para operar en OmniDrive necesitas verificar tu identidad subiendo fotos de tu documento y una selfie.'}
              </p>
            </div>
          </div>

          {user?.identityVerified && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <BadgeCheck size={18} className="text-green-400" />
                Documentos subidos
              </h3>
              {user?.selfieUrl && (
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800">
                    <img src={user.selfieUrl} className="w-full h-full object-cover" alt="Selfie" />
                  </div>
                  <div className="text-sm text-slate-400 space-y-1">
                    <p className="text-white font-medium">Selfie</p>
                    <p className="text-xs">Aprobada</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!user?.identityVerified && (
            <>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                    <ScanFace size={22} className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Verificación con documentos</h3>
                    <p className="text-xs text-slate-400">Sube fotos de tu cédula/pasaporte y una selfie.</p>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle size={12} className="text-green-400" />
                    <span>Foto frontal del documento</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle size={12} className="text-green-400" />
                    <span>Foto reverso del documento</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle size={12} className="text-green-400" />
                    <span>Selfie con tu rostro visible</span>
                  </div>
                </div>

                <button onClick={() => setShowVerification(true)}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-sm transition-colors">
                  {user?.selfieUrl ? 'Volver a subir documentos' : 'Subir documentos'}
                </button>
              </div>

              {/* Modal de verificación */}
              <VerificationModal
                isOpen={showVerification}
                onClose={() => setShowVerification(false)}
                onVerified={(data) => {
                  if (data?.user) {
                    updateUser({
                      identityVerified: data.user.identityVerified,
                      selfieUrl: data.user.selfieUrl,
                      documentFrontUrl: data.user.documentFrontUrl,
                      documentBackUrl: data.user.documentBackUrl,
                      verificationNotes: data.user.verificationNotes ?? null as any,
                    });
                  }
                }}
              />
            </>
          )}
        </div>
      )}


    </div>
  );
}
