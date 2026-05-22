import { useState, useEffect } from 'react';
import {
  Users, Car, CreditCard, AlertTriangle, BarChart2,
  BadgeCheck, ChevronRight, RefreshCw, CheckCircle, Search, Ban, Shield, Trash2, UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, adminApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

// Roles disponibles en el sistema
const ALL_TABS = ['Métricas', 'Usuarios', 'Vehículos', 'Reservas', 'Transacciones', 'Disputas', 'Vetos'] as const;
type Tab = typeof ALL_TABS[number];

// Permisos por rol
const ROLE_PERMS: Record<string, Tab[]> = {
  verifier: ['Usuarios', 'Vetos'],
  admin: ['Usuarios', 'Vehículos', 'Reservas', 'Disputas', 'Vetos'],
  superadmin: [...ALL_TABS, 'Admins'] as any,
};

const STATUS_COLORS: Record<string, string> = {
  pending:   'text-yellow-400 bg-yellow-400/10',
  confirmed: 'text-blue-400 bg-blue-400/10',
  active:    'text-green-400 bg-green-400/10',
  completed: 'text-slate-400 bg-slate-800',
  cancelled: 'text-red-400 bg-red-400/10',
  disputed:  'text-orange-400 bg-orange-400/10',
};

export default function Admin() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'superadmin';
  // Filtrar tabs segun rol
  const TABS: string[] = (ROLE_PERMS[user?.role || ''] || ALL_TABS) as unknown as string[];
  const [tab, setTab] = useState<string>(TABS[0] || 'Métricas');
  const [metrics, setMetrics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [banned, setBanned] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [disputeResolution, setDisputeResolution] = useState<Record<string, { text: string; amount: string }>>({});
  const [banForm, setBanForm] = useState({ documentId: '', reason: '' });
  const [showBanForm, setShowBanForm] = useState(false);
  // Admin management (superadmin only)
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '', role: 'admin' });
  const [createAdminLoading, setCreateAdminLoading] = useState(false);

  const createAdmin = async () => {
    setCreateAdminLoading(true);
    try {
      await api.post('/admin/create-admin', newAdmin);
      toast.success('Admin creado');
      setNewAdmin({ email: '', password: '', role: 'admin' });
      fetchTab('Admins');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al crear admin');
    } finally { setCreateAdminLoading(false); }
  };

  const deleteAdmin = async (userId: string, email: string) => {
    if (!confirm(`¿Eliminar a ${email}?`)) return;
    try {
      await api.delete('/admin/delete-admin/' + userId);
      toast.success('Admin eliminado');
      setAdmins(prev => prev.filter(a => a.id !== userId));
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al eliminar');
    }
  };

  const fetchTab = async (t: string) => {
    setLoading(true);
    try {
      switch (t) {
        case 'Métricas': { const r = await api.get('/admin/metrics'); setMetrics(r.data.data); break; }
        case 'Usuarios': { const r = await api.get('/admin/users', { params: { search: search || undefined } }); setUsers(r.data.data.users); break; }
        case 'Vehículos': { const r = await api.get('/admin/vehicles'); setVehicles(r.data.data.vehicles); break; }
        case 'Reservas': { const r = await api.get('/admin/bookings'); setBookings(r.data.data.bookings); break; }
        case 'Transacciones': { const r = await api.get('/admin/transactions'); setTransactions(r.data.data.transactions); break; }
        case 'Disputas': { const r = await api.get('/admin/disputes'); setDisputes(r.data.data); break; }
        case 'Vetos': { const r = await adminApi.bannedIdentities(); setBanned(r.data.data ?? r.data.banned ?? []); break; }
        case 'Admins': { const r = await api.get('/admin/admins'); setAdmins(r.data.data || []); break; }
      }
    } catch { toast.error('Error al cargar'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTab(tab); }, [tab]);

  const verifyUser = async (id: string) => {
    try {
      await api.put(`/admin/users/${id}/verify`);
      toast.success('Usuario verificado');
      fetchTab('Usuarios');
    } catch { toast.error('Error al verificar'); }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar permanentemente a ${name}?\n\nSe borrarán todos sus datos: perfil, vehículos, reservas, notificaciones y cuenta de Supabase.\n\nEsta acción NO se puede deshacer.`)) return;
    if (!confirm(`⚠️ Confirmación final\n\n¿Estás SEGURO de eliminar a ${name}?`)) return;
    setLoading(true);
    try {
      await adminApi.deleteUser(id);
      toast.success(`✅ ${name} eliminado`);
      fetchTab('Usuarios');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al eliminar usuario');
    } finally { setLoading(false); }
  };

  const resolveDispute = async (id: string) => {
    const r = disputeResolution[id];
    if (!r?.text) return toast.error('Escribe una resolución');
    try {
      await api.put(`/admin/disputes/${id}/resolve`, {
        resolution: r.text,
        refundAmount: r.amount ? parseFloat(r.amount) : 0,
      });
      toast.success('Disputa resuelta');
      fetchTab('Disputas');
    } catch { toast.error('Error al resolver'); }
  };

  const MetricCard = ({ label, value, sub, color = 'text-white' }: any) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Panel de administración</h1>
        <button onClick={() => fetchTab(tab)} className="text-slate-500 hover:text-white transition-colors">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
        </div>
      )}

      {/* ── MÉTRICAS ── */}
      {!loading && tab === 'Métricas' && metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total usuarios" value={metrics.totalUsers} sub={`${metrics.verifiedUsers} verificados`} />
            <MetricCard label="Total vehículos" value={metrics.totalVehicles} />
            <MetricCard label="Viajes activos" value={metrics.activeBookings} color="text-green-400" />
            <MetricCard label="Disputas abiertas" value={metrics.openDisputes} color={metrics.openDisputes > 0 ? 'text-orange-400' : 'text-white'} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label="Revenue hoy" value={`$${Number(metrics.revenueToday).toFixed(2)}`} color="text-green-400" sub="Comisiones (15%)" />
            <MetricCard label="Revenue este mes" value={`$${Number(metrics.revenueMonth).toFixed(2)}`} color="text-green-400" sub="Comisiones acumuladas" />
            <MetricCard label="Tasa de ocupación" value={`${metrics.occupancyRate}%`} color="text-indigo-400" sub="Vehículos activos / disponibles" />
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: Users, label: 'Gestionar usuarios', tab: 'Usuarios' as Tab },
              { icon: Car, label: 'Gestionar vehículos', tab: 'Vehículos' as Tab },
              { icon: AlertTriangle, label: `Disputas (${metrics.openDisputes})`, tab: 'Disputas' as Tab },
              { icon: CreditCard, label: 'Transacciones', tab: 'Transacciones' as Tab },
              { icon: BarChart2, label: 'Reservas', tab: 'Reservas' as Tab },
            ].map(({ icon: Icon, label, tab: t }) => (
              <button key={label} onClick={() => setTab(t)}
                className="flex items-center gap-3 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-4 transition-all text-left">
                <Icon size={18} className="text-indigo-400 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-300">{label}</span>
                <ChevronRight size={14} className="text-slate-600 ml-auto" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── USUARIOS ── */}
      {!loading && tab === 'Usuarios' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchTab('Usuarios')}
              placeholder="Buscar por email, nombre o documento..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Usuario', 'Documento', 'Wallet', 'Score', 'Estado', 'Acción'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{u.name} {u.lastName}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{u.documentType} · {u.documentId}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">${Number(u.walletBalance).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{u.driverScore}</td>

                    <td className="px-4 py-3">
                      {u.identityVerified
                        ? <span className="flex items-center gap-1 text-xs text-green-400"><BadgeCheck size={12} /> Verificado</span>
                        : <span className="text-xs text-yellow-400">Pendiente</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!u.identityVerified && u.selfieUrl && (
                          <button onClick={() => verifyUser(u.id)}
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                            <CheckCircle size={12} /> Verificar
                          </button>
                        )}
                        <button onClick={() => deleteUser(u.id, `${u.name} ${u.lastName}`)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-medium transition-colors">
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-500 text-sm">Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VEHÍCULOS ── */}
      {!loading && tab === 'Vehículos' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['Vehículo', 'Propietario', 'Placa', 'Precio/día', 'Rating', 'Rentas', 'Estado'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {vehicles.map(v => (
                <tr key={v.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{v.brand} {v.model} {v.year}</p>
                    <p className="text-xs text-slate-500 capitalize">{v.category}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{v.owner?.name} {v.owner?.lastName}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-300">{v.plate}</td>
                  <td className="px-4 py-3 text-sm text-white">${Number(v.pricePerDay).toFixed(0)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">⭐ {v.rating.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{v.totalRentals}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${v.available ? 'text-green-400 bg-green-400/10' : 'text-slate-500 bg-slate-800'}`}>
                      {v.available ? 'Disponible' : 'No disponible'}
                    </span>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500 text-sm">Sin vehículos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── RESERVAS ── */}
      {!loading && tab === 'Reservas' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['ID', 'Vehículo', 'Arrendatario', 'Fechas', 'Total', 'Estado'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {bookings.map(b => (
                <tr key={b.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{b.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{b.vehicle?.brand} {b.vehicle?.model}</p>
                    <p className="text-xs text-slate-500">{b.vehicle?.plate}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{b.tenant?.name} {b.tenant?.lastName}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(b.startAt).toLocaleDateString('es-EC')} → {new Date(b.endAt).toLocaleDateString('es-EC')}
                  </td>
                  <td className="px-4 py-3 font-medium text-white">${Number(b.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[b.status] ?? 'text-slate-400 bg-slate-800'}`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500 text-sm">Sin reservas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TRANSACCIONES ── */}
      {!loading && tab === 'Transacciones' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['ID', 'Tipo', 'Monto', 'Fee', 'Estado', 'Descripción', 'Fecha'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 capitalize text-slate-300">{t.type}</td>
                  <td className="px-4 py-3 font-medium text-white">${Number(t.amount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-400">${Number(t.fee).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'completed' ? 'text-green-400 bg-green-400/10' : t.status === 'pending' ? 'text-yellow-400 bg-yellow-400/10' : 'text-red-400 bg-red-400/10'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">{t.description ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString('es-EC')}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500 text-sm">Sin transacciones</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DISPUTAS ── */}
      {!loading && tab === 'Disputas' && (
        <div className="space-y-4">
          {disputes.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle size={48} className="mx-auto text-green-500/30 mb-3" />
              <p className="text-slate-500 text-sm">Sin disputas abiertas 🎉</p>
            </div>
          ) : disputes.map((d: any) => (
            <div key={d.id} className="bg-slate-900 border border-orange-500/20 rounded-2xl p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={16} className="text-orange-400" />
                    <p className="font-semibold text-white">Reserva {d.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <p className="text-sm text-slate-400">{d.vehicle?.brand} {d.vehicle?.model} · {d.vehicle?.plate}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Arrendatario: {d.tenant?.name} {d.tenant?.lastName} ({d.tenant?.email})</p>
                </div>
                <span className="text-xs text-orange-400 bg-orange-400/10 px-3 py-1 rounded-full border border-orange-400/20">Disputa</span>
              </div>

              {d.damageReport?.description && (
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Descripción del problema</p>
                  <p className="text-sm text-slate-300">{d.damageReport.description}</p>
                </div>
              )}

              {/* Photos evidence */}
              {(d.photosBefore?.length > 0 || d.photosAfter?.length > 0) && (
                <div className="grid grid-cols-2 gap-4">
                  {[['Fotos entrega', d.photosBefore], ['Fotos devolución', d.photosAfter]].map(([l, photos]) =>
                    (photos as string[])?.length > 0 ? (
                      <div key={l as string}>
                        <p className="text-xs text-slate-500 mb-2">{l as string}</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {(photos as string[]).slice(0, 3).map((p, i) => (
                            <img key={i} src={p} className="w-16 h-16 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80"
                              onClick={() => window.open(p, '_blank')} alt="" />
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {/* Resolution form */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <p className="text-sm font-medium text-white">Resolver disputa</p>
                <textarea
                  value={disputeResolution[d.id]?.text ?? ''}
                  onChange={e => setDisputeResolution(prev => ({ ...prev, [d.id]: { ...prev[d.id], text: e.target.value } }))}
                  placeholder="Escribe la resolución (ej: El tenant es responsable de los daños. Se retiene el depósito.)"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                    <input type="number" step="0.01" min="0"
                      value={disputeResolution[d.id]?.amount ?? ''}
                      onChange={e => setDisputeResolution(prev => ({ ...prev, [d.id]: { ...prev[d.id], amount: e.target.value } }))}
                      placeholder="Reembolso al tenant (0 = sin reembolso)"
                      className="w-full pl-7 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <button onClick={() => resolveDispute(d.id)}
                    className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 rounded-xl text-sm font-semibold transition-colors flex-shrink-0">
                    Resolver
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── VETOS ── */}
      {/* Superadmin: Gestionar admins */}
      {!loading && tab === 'Admins' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-3">Crear admin</h3>
            <div className="space-y-3">
              <input
                value={newAdmin.email} onChange={e => setNewAdmin(f => ({ ...f, email: e.target.value }))}
                placeholder="Email del nuevo admin"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input
                value={newAdmin.password} onChange={e => setNewAdmin(f => ({ ...f, password: e.target.value }))}
                type="password"
                placeholder="Contraseña"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-3">
                {[
                  { val: 'admin', label: 'Admin completo' },
                  { val: 'verifier', label: 'Verificador' },
                ].map(o => (
                  <button key={o.val} type="button"
                    onClick={() => setNewAdmin(f => ({ ...f, role: o.val }))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${newAdmin.role === o.val ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
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
            <h3 className="font-semibold text-white mb-3">Admins activos</h3>
            {admins.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No hay admins creados</p>
            ) : (
              <div className="space-y-2">
                {admins.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{a.name} {a.lastName}</p>
                      <p className="text-xs text-slate-500">{a.email} · {a.role}</p>
                    </div>
                    {a.role !== 'superadmin' && (
                      <button onClick={() => deleteAdmin(a.id, a.email)}
                        className="text-red-400 hover:text-red-300 text-xs px-3 py-1.5 bg-red-500/10 rounded-lg transition-colors">
                        Eliminar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && tab === 'Vetos' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban size={18} className="text-red-400" />
              <h2 className="text-lg font-bold text-white">Cédulas vetadas</h2>
            </div>
            <button onClick={() => setShowBanForm(!showBanForm)}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-semibold transition-colors">
              {showBanForm ? 'Cancelar' : 'Vetar cédula'}
            </button>
          </div>

          {/* Ban form */}
          {showBanForm && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Vetar nueva cédula</h3>
              <p className="text-xs text-slate-500">Las cédulas vetadas no podrán verificar su identidad ni operar en la plataforma.</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Número de cédula</label>
                  <input value={banForm.documentId} onChange={e => setBanForm(f => ({ ...f, documentId: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    placeholder="10 dígitos"
                    maxLength={10}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Motivo del veto</label>
                  <textarea value={banForm.reason} onChange={e => setBanForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="Ej: Fraude documentado, historial de estafas..."
                    rows={2}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              </div>
              <button onClick={async () => {
                if (banForm.documentId.length < 10 || !banForm.reason.trim()) {
                  toast.error('Completa todos los campos');
                  return;
                }
                try {
                  await adminApi.banIdentity(banForm);
                  toast.success('✅ Cédula vetada');
                  setShowBanForm(false);
                  setBanForm({ documentId: '', reason: '' });
                  fetchTab('Vetos');
                } catch (e: any) {
                  toast.error(e.response?.data?.error || 'Error al vetar');
                }
              }}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-colors">
                Vetar cédula
              </button>
            </div>
          )}

          {/* Banned list */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {banned.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Shield size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">No hay cédulas vetadas</p>
                <p className="text-xs text-slate-600 mt-1">Usa el botón superior para vetar una cédula</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {['Cédula', 'Motivo', 'Creado por', 'Estado', 'Fecha', 'Acción'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {banned.map((b: any) => (
                    <tr key={b.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-white font-medium">{b.documentId}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">{b.reason}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{b.createdBy?.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${b.active ? 'text-red-400 bg-red-400/10' : 'text-slate-500 bg-slate-800'}`}>
                          {b.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {b.active && (
                          <button onClick={async () => {
                            if (!confirm(`¿Desbloquear cédula ${b.documentId}?`)) return;
                            try {
                              await adminApi.unbanIdentity(b.id);
                              toast.success('Cédula desbloqueada');
                              fetchTab('Vetos');
                            } catch { toast.error('Error al desbloquear'); }
                          }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                            Desbloquear
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick verify tool */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Verificar cédula manualmente</h3>
            <p className="text-xs text-slate-500 mb-3">Consulta una cédula contra el Registro Civil directamente desde el panel.</p>
            <VerifyCedulaWidget />
          </div>
        </div>
      )}
    </div>
  );
}

/** Widget interno para verificar cédula desde admin */
function VerifyCedulaWidget() {
  const [cedula, setCedula] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    const clean = cedula.replace(/\D/g, '');
    if (clean.length !== 10) return toast.error('Ingresa 10 dígitos');
    setLoading(true);
    setResult(null);
    try {
      const { data: res } = await adminApi.verifyCedula(clean);
      setResult(res.data);
      if (res.data?.verification?.nombres) {
        toast.success('✅ Cédula activa en el Registro Civil');
      } else {
        toast.error(res.data?.error || 'Cédula no encontrada');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error en la consulta');
      setResult({ error: e.response?.data?.error });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={cedula} onChange={e => setCedula(e.target.value.replace(/\D/g, '').slice(0, 10))}
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
          placeholder="Número de cédula" maxLength={10}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600" />
        <button onClick={handleVerify} disabled={cedula.length !== 10 || loading}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap">
          {loading ? '...' : 'Consultar'}
        </button>
      </div>
      {result && (
        <div className={`rounded-xl p-3 text-xs ${result.verification?.nombres ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
          {result.verification?.nombres ? (
            <div className="space-y-1">
              <p className="text-green-400 font-medium">✅ Cédula activa</p>
              <p className="text-slate-300">{result.verification.nombres} {result.verification.apellidos}</p>
              <p className="text-slate-500">Estado: {result.verification.estado} · Proveedor: {result.verification.provedor}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-red-400 font-medium">✗ {result.error || 'Cédula no encontrada'}</p>
              {result.raw && <pre className="text-slate-600 mt-1 overflow-auto">{JSON.stringify(result.raw, null, 2)}</pre>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
