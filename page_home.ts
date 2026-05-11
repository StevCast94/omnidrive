import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Car, Shield, Star, Zap } from 'lucide-react';
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
  const [search, setSearch] = useState({ location: '', startAt: '', endAt: '', category: '' });

  useEffect(() => {
    vehiclesApi.list({ sort: 'rating_desc' })
      .then(r => setFeatured(r.data.data.slice(0, 6)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (search.location) params.set('location', search.location);
    if (search.startAt) params.set('startAt', search.startAt);
    if (search.endAt) params.set('endAt', search.endAt);
    if (search.category) params.set('category', search.category);
    navigate(`/vehicles?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-900 pt-20 pb-32">
        <img
          src="/hero-bg.svg"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        />
        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-indigo-400 text-sm font-medium mb-6">
            <Zap size={14} /> La plataforma P2P de vehículos de Ecuador
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Renta el vehículo<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              perfecto para ti
            </span>
          </h1>
          <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
            Conectamos propietarios y arrendatarios. Autos, motos, camionetas y más — con o sin chofer.
          </p>

          {/* Search box */}
          <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-2xl max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-1 relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text" placeholder="Ciudad o sector"
                  value={search.location}
                  onChange={e => setSearch(s => ({ ...s, location: e.target.value }))}
                  className="w-full pl-9 pr-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="datetime-local"
                  value={search.startAt}
                  onChange={e => setSearch(s => ({ ...s, startAt: e.target.value }))}
                  className="w-full pl-9 pr-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="datetime-local"
                  value={search.endAt}
                  onChange={e => setSearch(s => ({ ...s, endAt: e.target.value }))}
                  className="w-full pl-9 pr-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleSearch}
                className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-sm transition-colors"
              >
                <Search size={16} /> Buscar
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 -mt-8">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/vehicles?category=${c.id}`)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-all"
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Featured vehicles */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">Vehículos destacados</h2>
          <button onClick={() => navigate('/vehicles')} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            Ver todos →
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
          <div className="text-center py-20 text-slate-500">
            <Car size={48} className="mx-auto mb-4 opacity-30" />
            <p>Sé el primero en publicar un vehículo</p>
          </div>
        )}
      </section>

      {/* Features */}
      <section className="bg-slate-900/50 border-y border-slate-800 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-white text-center mb-12">¿Por qué OmniDrive?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: 'Seguridad verificada', desc: 'Todos los usuarios pasan por verificación de identidad con cédula o pasaporte.' },
              { icon: Star, title: 'Sistema de reseñas', desc: 'Calificaciones reales de cada viaje. Arrendatarios y propietarios verificados.' },
              { icon: Zap, title: 'Pagos P2P instantáneos', desc: 'Wallet interna para transferencias directas. Sin comisiones extra para suscriptores.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="inline-flex p-3 bg-indigo-500/10 rounded-2xl mb-4">
                  <Icon size={24} className="text-indigo-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">¿Tienes un vehículo sin usar?</h2>
        <p className="text-slate-400 mb-8">Publícalo en OmniDrive y genera ingresos. Es gratis, seguro y sencillo.</p>
        <button
          onClick={() => navigate('/register')}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors"
        >
          Publicar mi vehículo
        </button>
      </section>
    </div>
  );
}
