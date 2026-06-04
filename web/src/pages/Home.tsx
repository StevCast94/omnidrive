import { useState, useEffect } from 'react';
import { useNavigate } from '@/lib/router-exports';
import {
  Car, Shield, Star, Zap, ChevronRight, Search,
  TrendingUp, Clock, MessageCircle, LayoutGrid, Bike,
  Truck, Container, Gem, Gauge, KeyRound, Wallet, BadgeCheck,
} from 'lucide-react';
import { vehicles as vehiclesApi } from '@/lib/api';
import VehicleCard from '@/components/VehicleCard';
import AnimatedCounter from '@/components/AnimatedCounter';
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
  const [query, setQuery] = useState('');

  useEffect(() => {
    vehiclesApi.list({ sort: 'rating_desc' })
      .then(r => setFeatured(r.data.data.slice(0, 6)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = () => {
    navigate(query.trim() ? `/vehicles?q=${encodeURIComponent(query.trim())}` : '/vehicles');
  };

  return (
    <div className="min-h-screen bg-slate-950 overflow-hidden">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden pt-32 pb-20 md:pb-28 lg:pt-44 lg:pb-32 min-h-[88vh] flex items-center">
        {/* Fondo */}
        <div className="absolute inset-0 z-0">
          {/* Foto: movilidad + libertad + ruta abierta */}
          <img
            src="/hero-photo.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center scale-105 animate-[float_18s_ease-in-out_infinite]"
          />
          {/* Capas para integrar la foto al tema slate y dar legibilidad */}
          <div className="absolute inset-0 bg-slate-950/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-950/30 to-slate-950" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/50 via-transparent to-slate-950/50" />
          {/* Tinte de marca cyan/indigo */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(6,182,212,0.18)_0%,_transparent_45%)] mix-blend-screen" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(99,102,241,0.18)_0%,_transparent_45%)] mix-blend-screen" />
          {/* Grid sutil y blurs de acento */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:24px_24px]" />
          <div className="absolute left-0 right-0 top-0 m-auto h-[320px] w-[320px] rounded-full bg-cyan-500 opacity-15 blur-[120px] animate-pulse" />
          <div className="absolute right-16 bottom-10 h-[260px] w-[260px] rounded-full bg-indigo-500 opacity-15 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <div className="mb-7 animate-slide-up">
            <span className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-cyan-500/30 text-base md:text-lg font-semibold text-white shadow-[0_0_30px_rgba(6,182,212,0.12)]">
              <span className="text-xl md:text-2xl leading-none">🇪🇨</span>
              <span>La comunidad de movilidad de <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Ecuador</span></span>
            </span>
          </div>

          <h1 className="text-4xl md:text-7xl font-extrabold text-white mb-6 leading-[1.05] tracking-tight animate-slide-up stagger-1 [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]">
            Conduce lo que quieras,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500">
              cuando quieras.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 mb-9 max-w-2xl mx-auto animate-slide-up stagger-2 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">
            Encuentra y alquila el vehículo perfecto de anfitriones locales verificados.
            Sin trámites eternos, con contacto directo y precios en USD.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up stagger-3">
            <Button size="lg" onClick={() => navigate('/vehicles')}>
              <span className="flex items-center gap-2">
                Explorar vehículos <ChevronRight size={18} />
              </span>
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate('/register')}>
              Publicar el mío
            </Button>
          </div>

          {/* Barra de confianza */}
          <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl mx-auto animate-slide-up stagger-3">
            <TrustStat value={<AnimatedCounter to={9} suffix="+" />} label="Vehículos activos" icon={Car} />
            <TrustStat value={<AnimatedCounter to={100} suffix="%" />} label="Identidad verificada" icon={BadgeCheck} />
            <TrustStat value={<AnimatedCounter to={4.9} decimals={1} />} label="Calificación promedio" icon={Star} />
          </div>
        </div>
      </section>

      {/* ═══════════ Categorías ═══════════ */}
      <section className="max-w-7xl mx-auto px-4 -mt-10 relative z-10">
        <div className="flex flex-wrap justify-center gap-1.5">
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onClick={() => navigate(c.id ? `/vehicles?category=${c.id}` : '/vehicles')}
                className="flex-1 min-w-[100px] max-w-[140px] flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900/80 backdrop-blur-sm border border-slate-800/60 hover:border-cyan-500/40 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all duration-300 rounded-xl"
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
            <p className="text-sm text-slate-500 mt-1">Los mejor calificados por nuestra comunidad</p>
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

      {/* ═══════════ Dos formas de ganar ═══════════ */}
      <section className="bg-slate-900/40 border-y border-slate-800 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Dos formas de ganar</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              No es dueño contra arrendatario. Es una comunidad donde ambos lados salen adelante.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Arrendatario */}
            <div className="group relative bg-slate-950/60 border border-slate-800 hover:border-cyan-500/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-[0_0_40px_rgba(6,182,212,0.07)]">
              <div className="inline-flex p-3 bg-cyan-500/10 rounded-2xl mb-5">
                <KeyRound size={26} className="text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Necesitas moverte</h3>
              <p className="text-sm text-slate-400 mb-6">Accede al vehículo que necesitas, sin la deuda de comprarlo.</p>
              <ul className="space-y-3 mb-8">
                <Bullet icon={Search} text="Elige entre autos, SUV, camionetas y motos de dueños locales." />
                <Bullet icon={Shield} text="Cada anfitrión pasa verificación de identidad real." />
                <Bullet icon={Clock} text="Desde 1 día hasta semanas. Con o sin chofer. Tú decides." />
              </ul>
              <Button onClick={() => navigate('/vehicles')} className="w-full sm:w-auto">
                <span className="flex items-center gap-2">Explorar vehículos <ChevronRight size={16} /></span>
              </Button>
            </div>

            {/* Dueño */}
            <div className="group relative bg-slate-950/60 border border-slate-800 hover:border-indigo-500/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-[0_0_40px_rgba(99,102,241,0.08)]">
              <div className="inline-flex p-3 bg-indigo-500/10 rounded-2xl mb-5">
                <Wallet size={26} className="text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Tienes un vehículo</h3>
              <p className="text-sm text-slate-400 mb-6">Un auto parado 22 horas al día es un activo dormido. Despiértalo.</p>
              <ul className="space-y-3 mb-8">
                <Bullet icon={TrendingUp} text="Conviértelo en ingresos. Publicarlo es gratis." color="indigo" />
                <Bullet icon={Star} text="Reseñas mutuas: sabes a quién le entregas tu vehículo." color="indigo" />
                <Bullet icon={MessageCircle} text="Coordinación directa por WhatsApp. Sin intermediarios." color="indigo" />
              </ul>
              <Button variant="secondary" onClick={() => navigate('/register')} className="w-full sm:w-auto">
                <span className="flex items-center gap-2">Publicar mi vehículo <ChevronRight size={16} /></span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ Cómo funciona ═══════════ */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
          Alquilar es tan fácil como
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Search, step: '1', title: 'Elige tu vehículo', desc: 'Explora por categoría, precio o ubicación. Encuentra el que más te guste.' },
            { icon: CalendarIcon, step: '2', title: 'Elige las fechas', desc: 'Check-in y check-out flexible como en hotel. Mínimo 1 día, máximo el que quieras.' },
            { icon: MessageCircle, step: '3', title: 'Conecta con el dueño', desc: 'Coordinación directa por WhatsApp. Sin comisiones, con identidad verificada.' },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div key={step} className="text-center relative group">
              <div className="relative inline-flex mb-5">
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-xs font-bold z-10 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)]">
                  {step}
                </div>
                <div className="p-4 bg-cyan-500/10 rounded-2xl group-hover:bg-cyan-500/20 transition-colors">
                  <Icon size={28} className="text-cyan-400" />
                </div>
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ Manifiesto ═══════════ */}
      <section className="relative overflow-hidden border-y border-slate-800 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.08)_0%,_transparent_60%)]" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[300px] w-[300px] rounded-full bg-cyan-500 opacity-10 blur-[120px]" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <Badge variant="indigo" className="mb-6 px-4 py-1.5">Nuestra visión</Badge>
          <p className="text-2xl md:text-4xl font-bold text-white leading-tight tracking-tight">
            Cada vehículo tiene el potencial de{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">pagarse solo</span>.
            No vendemos alquileres: democratizamos la movilidad y convertimos
            pasivos en activos, con la cooperación como pilar.
          </p>
          <p className="mt-6 text-slate-400 max-w-xl mx-auto">
            Esto no es otro marketplace. Es un movimiento de movilidad para Ecuador. Únete.
          </p>
        </div>
      </section>

      {/* ═══════════ CTA Final (dueño) ═══════════ */}
      <section className="relative overflow-hidden bg-gradient-to-r from-cyan-900/50 to-indigo-900/50 border-b border-cyan-800/30 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.1)_0%,_transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            ¿Tienes un vehículo parado?
          </h2>
          <p className="text-slate-300 text-lg mb-8 max-w-xl mx-auto">
            Convierte ese activo dormido en ingresos. Publicarlo es gratis y te toma minutos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={() => navigate('/register')} variant="primary" size="lg">
              Publicar mi vehículo
            </Button>
            <Button onClick={() => navigate('/vehicles')} variant="secondary" size="lg">
              Ver como arrendatario
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Subcomponentes ─── */

function TrustStat({ value, label, icon: Icon }: { value: React.ReactNode; label: string; icon: any }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-slate-900/40 border border-slate-800/60 px-2 py-4 backdrop-blur-sm">
      <Icon size={18} className="text-cyan-400 mb-1" />
      <span className="text-2xl md:text-3xl font-extrabold text-white tabular-nums">{value}</span>
      <span className="text-[11px] md:text-xs text-slate-500 leading-tight">{label}</span>
    </div>
  );
}

function Bullet({ icon: Icon, text, color = 'cyan' }: { icon: any; text: string; color?: 'cyan' | 'indigo' }) {
  const c = color === 'indigo' ? 'text-indigo-400' : 'text-cyan-400';
  return (
    <li className="flex items-start gap-3">
      <Icon size={18} className={`${c} mt-0.5 shrink-0`} />
      <span className="text-sm text-slate-300 leading-relaxed">{text}</span>
    </li>
  );
}

function CalendarIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>;
}
