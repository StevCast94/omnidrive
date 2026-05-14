import { useState, useEffect } from 'react';
import { useNavigate, Link } from '@/lib/router-exports';
import {
  Car, Shield, Star, Zap, User, ChevronRight,
  TrendingUp, Clock, Award
} from 'lucide-react';
import { vehicles as vehiclesApi } from '@/lib/api';
import VehicleCard from '@/components/VehicleCard';

const CATEGORIES = [
  { id: '', label: 'Todos', emoji: '🚗' },
  { id: 'car', label: 'Autos', emoji: '🚗' },
  { id: 'suv', label: 'SUV', emoji: '🚙' },
  { id: 'motorcycle', label: 'Motos', emoji: '🏍️' },
  { id: 'van', label: 'Furgonetas', emoji: '🚐' },
  { id: 'truck', label: 'Camionetas', emoji: '🛻' },
  { id: 'luxury', label: 'Lujo', emoji: '✨' },
];

export default function Home() {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vehiclesApi.list({ sort: 'rating_desc' })
      .then(r => setFeatured(r.data.data.slice(0, 6)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ═══════════ HERO — Persuasivo, sin buscador ═══════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 pt-16 pb-24 md:pb-32">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.08)_0%,_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(139,92,246,0.06)_0%,_transparent_50%)]" />

        <div className="relative max-w-5xl mx-auto px-4 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-indigo-400 text-sm font-medium mb-6">
            <Zap size={14} /> La plataforma P2P de vehículos de Ecuador
          </div>

          {/* Headline principal */}
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
            Renta un vehículo sin complicaciones
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            Conectamos propietarios y arrendatarios de forma segura.
            Autos, motos, camionetas y más — sin papeleo ni sucursales.
          </p>

          {/* CTA principal — lleva directamente a ver vehículos */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/vehicles')}
              className="group flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-base transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/40"
            >
              Ver vehículos disponibles
              <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl font-semibold text-sm transition-colors"
            >
              Publicar mi vehículo
            </button>
          </div>

          {/* Stats sociales — rápida validación de confianza */}
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {[
              { icon: Car, value: featured.length + '+', label: 'Vehículos' },
              { icon: User, value: featured.length * 2 + '+', label: 'Usuarios' },
              { icon: Star, value: '4.8', label: 'Calificación' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="text-center">
                <div className="inline-flex p-2 bg-slate-800/80 rounded-xl mb-2">
                  <Icon size={18} className="text-indigo-400" />
                </div>
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ Categorías ═══════════ */}
      <section className="max-w-7xl mx-auto px-4 -mt-12 relative z-10">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/vehicles?category=${c.id}`)}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-3 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-2xl text-sm font-medium text-slate-300 hover:text-white transition-all shadow-lg shadow-black/20"
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* ═══════════ Vehículos destacados ═══════════ */}
      <section className="max-w-7xl mx-auto px-4 py-16 md:py-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Vehículos destacados</h2>
            <p className="text-sm text-slate-500 mt-1">Los más populares entre nuestros arrendatarios</p>
          </div>
          <button onClick={() => navigate('/vehicles')}
            className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            Ver todos <ChevronRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-slate-900 rounded-2xl h-72 animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : featured.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map(v => <VehicleCard key={v.id} vehicle={v} />)}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
            <Car size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">Aún no hay vehículos publicados</p>
            <p className="text-sm mb-6">Sé el primero en ofrecer tu vehículo en OmniDrive</p>
            <button onClick={() => navigate('/register')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-sm transition-colors">
              Publicar mi vehículo
            </button>
          </div>
        )}
      </section>

      {/* ═══════════ Cómo funciona ═══════════ */}
      <section className="bg-slate-900/50 border-y border-slate-800 py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
            Alquilar es tan fácil como
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Search, step: '1', title: 'Elige tu vehículo', desc: 'Explora por categoría o encuentra el que más te guste.' },
              { icon: CalendarCheck, step: '2', title: 'Selecciona las fechas', desc: 'Check-in y check-out como en hotel. Mínimo 1 día.' },
              { icon: ShieldCheck, step: '3', title: 'Reserva segura', desc: 'Pago protegido en wallet. Verificación de identidad incluida.' },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="text-center relative">
                <div className="relative inline-flex mb-5">
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold z-10">
                    {step}
                  </div>
                  <div className="p-4 bg-indigo-500/10 rounded-2xl">
                    <Icon size={28} className="text-indigo-400" />
                  </div>
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ Beneficios ═══════════ */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">¿Por qué OmniDrive?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Shield, title: 'Seguridad verificada', desc: 'Todos los usuarios pasan por verificación de identidad con cédula o pasaporte. Sin excepciones.' },
            { icon: Star, title: 'Sistema de reseñas', desc: 'Calificaciones reales de cada viaje. Arrendatarios y propietarios evaluados mutuamente.' },
            { icon: Zap, title: 'Pagos P2P instantáneos', desc: 'Wallet interna para transferencias directas. Sin comisiones extra para suscriptores.' },
            { icon: Clock, title: 'Flexibilidad total', desc: 'Desde 1 día hasta semanas. Con o sin chofer. Tú pones las reglas.' },
            { icon: TrendingUp, title: 'Para dueños: genera ingresos', desc: 'Tu vehículo parado es dinero perdido. Publícalo gratis y empieza a recibir solicitudes.' },
            { icon: Award, title: 'Soporte Ecuador', desc: 'Pensada para el mercado ecuatoriano. Precios en USD, soporte en español.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/40 transition-colors">
              <div className="inline-flex p-3 bg-indigo-500/10 rounded-2xl mb-4">
                <Icon size={22} className="text-indigo-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ CTA Final ═══════════ */}
      <section className="relative overflow-hidden bg-gradient-to-r from-indigo-900/50 to-violet-900/50 border-y border-indigo-800/30 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.1)_0%,_transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            ¿Tienes un vehículo sin usar?
          </h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Miles de personas buscan vehículos para alquilar cada día.
            Publica el tuyo gratis y empieza a generar ingresos desde hoy.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-white text-slate-900 hover:bg-slate-200 rounded-2xl font-bold text-base transition-colors"
            >
              Publicar mi vehículo
            </button>
            <button
              onClick={() => navigate('/vehicles')}
              className="px-8 py-4 bg-slate-800/70 hover:bg-slate-700 border border-slate-700 rounded-2xl font-semibold text-sm transition-colors"
            >
              Ver como arrendatario
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// Helper icons que no están en lucide por defecto
function Search(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>; }
function CalendarCheck(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>; }
function ShieldCheck(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>; }
