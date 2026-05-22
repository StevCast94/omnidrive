// ══════════════════════════════════════════════════════════════════
// Admin.tsx — Panel de administración de OmniDrive
// Login independiente con username + password (JWT propio)
// NO usa Supabase Auth ni useAuthStore
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import {
  Users, Car, CreditCard, AlertTriangle, BarChart2,
  BadgeCheck, ChevronRight, RefreshCw, CheckCircle, Search, Ban, Shield, Trash2, UserPlus, LogOut, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Auth helpers (JWT propio, localStorage) ──
const ADMIN_TOKEN_KEY = 'omnidrive_admin_token';
const ADMIN_USER_KEY = 'omnidrive_admin_user';

function getToken(): string | null { return localStorage.getItem(ADMIN_TOKEN_KEY); }
function getSavedUser(): any {
  try { return JSON.parse(localStorage.getItem(ADMIN_USER_KEY) || 'null'); } catch { return null; }
}
function saveAuth(token: string, user: any) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

async function adminFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const res = await fetch('/api/admin' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? 'Bearer ' + token : '',
      ...((options.headers || {}) as Record<string, string>),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
  return data;
}

// ── Login Component ──
function AdminLogin({ onLogin }: { onLogin: (admin: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Intentar restaurar sesión guardada
    const saved = getSavedUser();
    const token = getToken();
    if (saved && token) {
      adminFetch('/auth/verify').then(d => {
        if (d.ok) onLogin(d.admin);
      }).catch(() => clearAuth());
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await adminFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (data.token && data.admin) {
        saveAuth(data.token, data.admin);
        onLogin(data.admin);
      } else {
        setError('Respuesta inválida del servidor');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 mb-4">
            <Lock size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin OmniDrive</h1>
          <p className="text-sm text-slate-400 mt-1">Panel de administración</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Usuario</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              placeholder="admin"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              placeholder=""
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-all"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Constants ──
const ALL_TABS = ['Métricas', 'Usuarios', 'Vehículos', 'Reservas', 'Transacciones', 'Disputas', 'Vetos'];
const ROLE_TABS: Record<string, string[]> = {
  verifier: ['Usuarios', 'Vetos'],
  admin: ['Usuarios', 'Vehículos', 'Reservas', 'Disputas', 'Vetos'],
  superadmin: [...ALL_TABS, 'Admins'],
};

const STATUS_COLORS: Record<string, string> = {
  pending:   'text-yellow-400 bg-yellow-400/10',
  confirmed: 'text-blue-400 bg-blue-400/10',
  active:    'text-green-400 bg-green-400/10',
  completed: 'text-slate-400 bg-slate-800',
  cancelled: 'text-red-400 bg-red-400/10',
  disputed:  'text-orange-400 bg-orange-400/10',
};

// ── Main Admin Component ──
export default function Admin() {
  const [admin, setAdmin] = useState<any>(getSavedUser);
  const [validating, setValidating] = useState(true);

  // Validar token al cargar
  useEffect(() => {
    const token = getToken();
    if (admin && token) {
      adminFetch('/auth/verify').then(d => {
        if (d.ok) { setAdmin(d.admin); saveAuth(token, d.admin); }
        else { clearAuth(); setAdmin(null); }
      }).catch(() => { clearAuth(); setAdmin(null); })
      .finally(() => setValidating(false));
    } else {
      setValidating(false);
    }
  }, []);

  if (validating) return <div className="min-h-screen bg-slate-950" />;
  if (!admin) return <AdminLogin onLogin={(a) => setAdmin(a)} />;

  return <AdminDashboard admin={admin} onLogout={() => { clearAuth(); setAdmin(null); }} />;
}

// ── Dashboard ──
function AdminDashboard({ admin, onLogout }: { admin: any; onLogout: () => void }) {
  const isSuperAdmin = admin?.role === 'superadmin';
  const TABS = ROLE_TABS[admin?.role || ''] || ALL_TABS;
  const [tab, setTab] = useState(TABS[0] || 'Métricas');

  // Data states
  const [metrics, setMetrics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [banned, setBanned] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showBanForm, setShowBanForm] = useState(false);
  const [banForm, setBanForm] = useState({ documentId: '', reason: '' });
  const [showDisputeModal, setShowDisputeModal] = useState<string | null>(null);
  const [disputeResolution, setDisputeResolution] = useState<Record<string, { text: string; amount: string }>>({});

  // Admin creation
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '', role: 'admin' });
  const [createAdminLoading, setCreateAdminLoading] = useState(false);

  const fetchTab = async (t: string) => {
    setLoading(true);
    try {
      switch (t) {
        case 'Métricas': { const r = await adminFetch('/metrics'); setMetrics(r.data); break; }
        case 'Usuarios': { const r = await adminFetch('/users?search=' + encodeURIComponent(search)); setUsers(r.data.users || []); break; }
        case 'Vehículos': { const r = await adminFetch('/vehicles'); setVehicles(r.data.vehicles || []); break; }
        case 'Reservas': { const r = await adminFetch('/bookings'); setBookings(r.data.bookings || []); break; }
        case 'Transacciones': { const r = await adminFetch('/transactions'); setTransactions(r.data.transactions || []); break; }
        case 'Disputas': { const r = await adminFetch('/disputes'); setDisputes(r.data || []); break; }
        case 'Vetos': { const r = await adminFetch('/banned-identities'); setBanned(r.data || r.banned || []); break; }
        case 'Admins': { const r = await adminFetch('/admins'); setAdmins(r.data || []); break; }
      }
    } catch { toast.error('Error al cargar'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTab(tab); }, [tab]);

  const verifyUser = async (id: string) => {
    try { await adminFetch('/users/' + id + '/verify', { method: 'PUT' }); toast.success('Verificado'); fetchTab('Usuarios'); }
    catch { toast.error('Error'); }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar a ${name}?`)) return;
    try { await adminFetch('/users/' + id, { method: 'DELETE' }); toast.success('Eliminado'); fetchTab('Usuarios'); }
    catch { toast.error('Error'); }
  };

  const resolveDispute = async (id: string) => {
    const r = disputeResolution[id];
    if (!r?.text) return toast.error('Escribe resolución');
    try {
      await adminFetch('/disputes/' + id + '/resolve', {
        method: 'PUT',
        body: JSON.stringify({ resolution: r.text, refundAmount: parseFloat(r.amount || '0') }),
      });
      toast.success('Disputa resuelta');
      setShowDisputeModal(null);
      fetchTab('Disputas');
    } catch { toast.error('Error'); }
  };

  const banIdentity = async () => {
    if (!banForm.documentId || !banForm.reason) return toast.error('Completa todos los campos');
    try { await adminFetch('/banned-identities', { method: 'POST', body: JSON.stringify(banForm) }); toast.success('Vetado'); setShowBanForm(false); setBanForm({ documentId: '', reason: '' }); fetchTab('Vetos'); }
    catch { toast.error('Error'); }
  };

  const unbanIdentity = async (id: string) => {
    try { await adminFetch('/banned-identities/' + id, { method: 'DELETE' }); toast.success('Desbloqueado'); fetchTab('Vetos'); }
    catch { toast.error('Error'); }
  };

  const createAdmin = async () => {
    setCreateAdminLoading(true);
    try {
      await adminFetch('/create-admin', { method: 'POST', body: JSON.stringify(newAdmin) });
      toast.success('Admin creado');
      setNewAdmin({ email: '', password: '', role: 'admin' });
      fetchTab('Admins');
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setCreateAdminLoading(false); }
  };

  const deleteAdmin = async (userId: string, email: string) => {
    if (!confirm(`¿Eliminar a ${email}?`)) return;
    try { await adminFetch('/delete-admin/' + userId, { method: 'DELETE' }); toast.success('Eliminado'); setAdmins(prev => prev.filter((a: any) => a.id !== userId)); }
    catch { toast.error('Error'); }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">Admin OmniDrive</h1>
            <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {admin?.role === 'superadmin' ? 'Superadmin' : admin?.role === 'admin' ? 'Admin' : 'Verificador'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{admin?.username}</span>
            <button onClick={onLogout} className="text-slate-500 hover:text-white transition p-2">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 whitespace-nowrap py-2 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 pb-12 space-y-6">

        {/* ── Loading ── */}
        {loading && <div className="text-center py-12"><div className="animate-spin w-8 h-8 border-t-2 border-cyan-400 rounded-full mx-auto" /></div>}

        {/* ═══ Métricas ═══ */}
        {!loading && tab === 'Métricas' && metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Usuarios', val: metrics.totalUsers, icon: Users },
              { label: 'Verificados', val: metrics.verifiedUsers, icon: BadgeCheck },
              { label: 'Vehículos', val: metrics.totalVehicles, icon: Car },
              { label: 'Reservas activas', val: metrics.activeBookings, icon: CreditCard },
              { label: 'Disputas', val: metrics.openDisputes, icon: AlertTriangle },
              { label: 'Ocupación', val: metrics.occupancyRate + '%', icon: BarChart2 },
              { label: 'Hoy', val: '$' + Number(metrics.revenueToday).toFixed(2), icon: CreditCard },
              { label: 'Mes', val: '$' + Number(metrics.revenueMonth).toFixed(2), icon: CreditCard },
            ].map(({ label, val, icon: Icon }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-indigo-600/20 rounded-xl"><Icon size={16} className="text-indigo-400" /></div>
                  <span className="text-xs text-slate-500">{label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{val}</p>
              </div>
            ))}
          </div>
        )}

        {/* ═══ Usuarios ═══ */}
        {!loading && tab === 'Usuarios' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchTab('Usuarios')}
                placeholder="Buscar por email, nombre o cédula..." 
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={() => fetchTab('Usuarios')} className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-colors"><Search size={16} /></button>
            </div>
            {users.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-10">Sin resultados</p>
            ) : (
              <div className="space-y-2">
                {users.map((u: any) => (
                  <div key={u.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {u.name?.[0]}{u.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{u.name} {u.lastName}</p>
                      <p className="text-xs text-slate-500">{u.email} · {u.documentId || 'Sin doc'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.identityVerified ? (
                        <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">Verificado</span>
                      ) : (
                        <button onClick={() => verifyUser(u.id)} className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg">Verificar</button>
                      )}
                      <button onClick={() => deleteUser(u.id, u.name + ' ' + u.lastName)} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Vehículos ═══ */}
        {!loading && tab === 'Vehículos' && (
          <div className="space-y-2">
            {vehicles.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-10">Sin vehículos</p>
            ) : (
              vehicles.map((v: any) => (
                <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0">
                    {v.photos?.[0] ? <img src={v.photos[0]} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Car size={20} className="text-slate-600" /></div>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{v.brand} {v.model} {v.year}</p>
                    <p className="text-xs text-slate-500">{v.plate} · {v.category}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-lg ${v.available ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>{v.available ? 'Disponible' : 'Rentado'}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">${Number(v.pricePerDay).toFixed(0)}/día</p>
                    <p className="text-xs text-slate-500">{v.rating > 0 ? '★ ' + v.rating.toFixed(1) : 'Nuevo'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ Reservas ═══ */}
        {!loading && tab === 'Reservas' && (
          <div className="space-y-2">
            {bookings.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-10">Sin reservas</p>
            ) : (
              bookings.map((b: any) => (
                <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{b.vehicle?.brand} {b.vehicle?.model}</p>
                      <p className="text-xs text-slate-500">{b.renter?.name} → {b.tenant?.name}</p>
                      <p className="text-xs text-slate-500">{new Date(b.startAt).toLocaleDateString()} - {new Date(b.endAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-lg ${STATUS_COLORS[b.status] || 'text-slate-400 bg-slate-800'}`}>
                      {b.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ Transacciones ═══ */}
        {!loading && tab === 'Transacciones' && (
          <p className="text-center text-sm text-slate-500 py-10">Próximamente</p>
        )}

        {/* ═══ Disputas ═══ */}
        {!loading && tab === 'Disputas' && (
          <div className="space-y-2">
            {disputes.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-10">Sin disputas</p>
            ) : (
              disputes.map((d: any) => (
                <div key={d.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{d.title || 'Disputa'}</p>
                      <p className="text-xs text-slate-500">{d.description?.slice(0, 100)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.status === 'open' && (
                        <button onClick={() => setShowDisputeModal(d.id)} className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors">Resolver</button>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-lg ${d.status === 'open' ? 'text-orange-400 bg-orange-500/10' : 'text-green-400 bg-green-500/10'}`}>
                        {d.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ Vetos ═══ */}
        {!loading && tab === 'Vetos' && (
          <div className="space-y-4">
            <button onClick={() => setShowBanForm(!showBanForm)}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-colors">
              {showBanForm ? 'Cancelar' : 'Vetar cédula'}
            </button>
            {showBanForm && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white">Vetar cédula</h3>
                <input value={banForm.documentId} onChange={e => setBanForm(f => ({ ...f, documentId: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  placeholder="Número de cédula" maxLength={10}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none" />
                <input value={banForm.reason} onChange={e => setBanForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Motivo del veto" 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" />
                <button onClick={banIdentity} disabled={!banForm.documentId || !banForm.reason}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
                  Vetar
                </button>
              </div>
            )}
            <div className="space-y-2">
              {banned.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-6">Sin vetos activos</p>
              ) : (
                banned.map((b: any) => (
                  <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{b.documentId}</p>
                      <p className="text-xs text-slate-500">{b.reason || 'Sin motivo'}</p>
                    </div>
                    <button onClick={() => unbanIdentity(b.id)} className="text-xs text-green-400 hover:text-green-300 bg-green-500/10 px-3 py-1.5 rounded-lg transition-colors">Desbloquear</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ═══ Admins (superadmin) ═══ */}
        {!loading && tab === 'Admins' && isSuperAdmin && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><UserPlus size={16} className="text-cyan-400" /> Crear admin</h3>
              <div className="space-y-3">
                <input value={newAdmin.email} onChange={e => setNewAdmin(f => ({ ...f, email: e.target.value }))} placeholder="Email del admin" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none" />
                <input value={newAdmin.password} onChange={e => setNewAdmin(f => ({ ...f, password: e.target.value }))} type="password" placeholder="Contraseña" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none" />
                <div className="flex gap-3">
                  {[{ val: 'admin', label: 'Admin completo' }, { val: 'verifier', label: 'Verificador' }].map(o => (
                    <button key={o.val} type="button" onClick={() => setNewAdmin(f => ({ ...f, role: o.val }))}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${newAdmin.role === o.val ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <button onClick={createAdmin} disabled={createAdminLoading || !newAdmin.email || !newAdmin.password}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
                  {createAdminLoading ? 'Creando...' : 'Crear admin'}
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-4">Admins activos</h3>
              {admins.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No hay admins</p>
              ) : (
                <div className="space-y-2">
                  {admins.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{a.name} {a.lastName}</p>
                        <p className="text-xs text-slate-500">{a.email} · {a.role === 'superadmin' ? 'Superadmin' : a.role === 'admin' ? 'Admin' : 'Verificador'}</p>
                      </div>
                      {a.role !== 'superadmin' && (
                        <button onClick={() => deleteAdmin(a.id, a.email)} className="text-red-400 hover:text-red-300 text-xs px-3 py-1.5 bg-red-500/10 rounded-lg">Eliminar</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
