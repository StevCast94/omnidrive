import { useState, useEffect } from 'react';
import { useNavigate, Link } from '@/lib/router-exports';
import {
  Car, Shield, Star, Zap, User, ChevronRight,
  TrendingUp, Clock, Award, Gauge, LayoutGrid, Bike, 
  Truck, Container, Gem
} from 'lucide-react';
import { vehicles as vehiclesApi } from '@/lib/api';
import VehicleCard from '@/components/VehicleCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const CATEGORIES = [
  { id: '', label: 'Todos', icon: LayoutGrid },
  { id: 'car', label: 'Autos', icon: Car },
  { id: 'suv', label: 'SUV', icon: Gauge },
  { id: 'motorcycle', label: 'Motos', icon: Bike },
  { id: 'van', label: 'Furgonetas', icon: Container },
  { id: 'truck', label: 'Camionetas', icon: Truck },
  { id: 'luxury', label: 'Lujo', icon: Gem },
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
    <div className="min-h-screen bg-slate-950 overflow-hidden">
      {/* ═══════════ HERO — con efectos de fondo rediseñados ═══════════ */}
      <section className="relative overflow-hidden pt-32 pb-24 md:pb-32 lg:pt-48 lg:pb-36 min-h-[80vh] flex items-center">
        {/* Background Effects — gradientes, grid, blur */}
        <div className="absolute inset-0 z-0">
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
          {/* Gradient glowing orbs */}
          <div className="absolute left-0 right-0 top-0 m-auto h-[310px] w-[310px] rounded-full bg-cyan-500 opacity-20 blur-[100px] animate-pulse" />
          <div className="absolute right-20 bottom-0 h-[250px] w-[250px] rounded-full bg-indigo-500 opacity-20 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
          {/* Original radial gradients (keep for compatibility) */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.08)_0%,_transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(139,92,246,0.06)_0%,_transparent_50%)]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          {/* Badge */}
          <Badge variant="cyan" className="mb-6 px-4 py-1.5 text-sm">
            <Zap size={14} className="mr-1" /> El futuro de la movilidad compartida
          </Badge>

          {/* Headline con gradient text */}
          <h1 className="text-4xl md:text-7xl font-extrabold text-white mb-4 leading-tight tracking-tight">
            Conduce cualquier auto,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">
              en cualquier lugar.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Únete a la red P2P más avanzada. Renta el vehículo perfecto de anfitriones locales o genera ingresos con el tuyo.
          </p>

          {/* CTA principal */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate('/vehicles')}
            >
              <span className="flex items-center gap-2">
                Explorar Vehículos <ChevronRight size={18} />
              </span>
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate('/register')}
            >
              Convertirse en Anfitrión
            </Button>
          </div>

          {/* Stats sociales — eliminados */}
        </div>
      </section>

      {/* ═══════════ Categorías — rectangulares, full-width ═══════════ */}
      <section className="max-w-7xl mx-auto px-4 -mt-16 relative z-10">
        <div className="flex flex-wrap justify-center gap-1.5">
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onClick={() => navigate(c.id ? `/vehicles?category=${c.id}` : '/vehicles')}
                className="flex-1 min-w-[100px] max-w-[140px] flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900/80 backdrop-blur-sm border border-slate-800/60 hover:border-cyan-500/40 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all duration-300"
              >
                <Icon size={14} className="text-cyan-400/70 shrink-0" />
                <span>{c.label}</span>
              </button>
            );
          })}
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
            className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
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
            <Button onClick={() => navigate('/register')}>
              Publicar mi vehículo
            </Button>
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
              { icon: SearchIcon, step: '1', title: 'Elige tu vehículo', desc: 'Explora por categoría o encuentra el que más te guste.' },
              { icon: CalendarIcon, step: '2', title: 'Selecciona las fechas', desc: 'Check-in y check-out como en hotel. Mínimo 1 día.' },
              { icon: ShieldIcon, step: '3', title: 'Reserva segura', desc: 'Pago protegido en wallet. Verificación de identidad incluida.' },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="text-center relative">
                <div className="relative inline-flex mb-5">
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-xs font-bold z-10 text-white">
                    {step}
                  </div>
                  <div className="p-4 bg-cyan-500/10 rounded-2xl">
                    <Icon size={28} className="text-cyan-400" />
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
            <div key={title} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-cyan-500/40 transition-colors">
              <div className="inline-flex p-3 bg-cyan-500/10 rounded-2xl mb-4">
                <Icon size={22} className="text-cyan-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ CTA Final ═══════════ */}
      <section className="relative overflow-hidden bg-gradient-to-r from-cyan-900/50 to-indigo-900/50 border-y border-cyan-800/30 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.1)_0%,_transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            ¿Tienes un vehículo sin usar?
          </h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Miles de personas buscan vehículos para alquilar cada día.
            Publica el tuyo gratis y empieza a generar ingresos desde hoy.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={() => navigate('/register')}
              variant="primary"
              size="lg"
            >
              Publicar mi vehículo
            </Button>
            <Button
              onClick={() => navigate('/vehicles')}
              variant="secondary"
              size="lg"
            >
              Ver como arrendatario
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

// SVG helper icons for "Cómo funciona" section
function SearchIcon(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>; }
function CalendarIcon(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>; }
function ShieldIcon(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>; }
