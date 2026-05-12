import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from '@/lib/router-exports';
import { SlidersHorizontal, X, Search, Car } from 'lucide-react';
import { vehicles as vehiclesApi } from '@/lib/api';
import VehicleCard from '@/components/VehicleCard';
import clsx from 'clsx';

const CATEGORIES = ['car', 'suv', 'motorcycle', 'van', 'truck', 'luxury'];
const SORTS = [
  { val: 'rating_desc', label: 'Mejor calificados' },
  { val: 'price_asc', label: 'Menor precio' },
  { val: 'price_desc', label: 'Mayor precio' },
  { val: 'distance', label: 'Más cercanos' },
];

export default function VehicleList() {
  const [sp, setSp] = useSearchParams();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    category: sp.get('category') ?? '',
    startAt: sp.get('startAt') ?? '',
    endAt: sp.get('endAt') ?? '',
    minPrice: sp.get('minPrice') ?? '',
    maxPrice: sp.get('maxPrice') ?? '',
    withDriver: sp.get('withDriver') === 'true',
    sort: sp.get('sort') ?? 'rating_desc',
  });

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.category) params.category = filters.category;
      if (filters.startAt) params.startAt = filters.startAt;
      if (filters.endAt) params.endAt = filters.endAt;
      if (filters.minPrice) params.minPrice = filters.minPrice;
      if (filters.maxPrice) params.maxPrice = filters.maxPrice;
      if (filters.withDriver) params.withDriver = true;
      params.sort = filters.sort;
      const { data: res } = await vehiclesApi.list(params);
      setVehicles(res.data);
    } catch {
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const setF = (k: string, v: any) => setFilters(f => ({ ...f, [k]: v }));

  const activeFilters = [
    filters.category && `Categoría: ${filters.category}`,
    filters.withDriver && 'Con chofer',
    (filters.minPrice || filters.maxPrice) && `$${filters.minPrice || 0}–$${filters.maxPrice || '∞'}`,
    (filters.startAt || filters.endAt) && 'Fechas seleccionadas',
  ].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Vehículos disponibles</h1>
          {!loading && (
            <p className="text-sm text-slate-500 mt-0.5">{vehicles.length} resultados</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filters.sort} onChange={e => setF('sort', e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SORTS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
              showFilters ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            )}
          >
            <SlidersHorizontal size={16} /> Filtros
            {activeFilters.length > 0 && (
              <span className="bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeFilters.map((f, i) => (
            <span key={i} className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-3 py-1 rounded-full">
              {f}
            </span>
          ))}
          <button
            onClick={() => setFilters({ category: '', startAt: '', endAt: '', minPrice: '', maxPrice: '', withDriver: false, sort: 'rating_desc' })}
            className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1"
          >
            <X size={12} /> Limpiar
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar filters */}
        {showFilters && (
          <aside className="w-64 flex-shrink-0 space-y-6">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-5">
              {/* Category */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Categoría</h3>
                <div className="space-y-1.5">
                  {['', ...CATEGORIES].map(c => (
                    <label key={c} className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" name="cat" checked={filters.category === c}
                        onChange={() => setF('category', c)}
                        className="accent-indigo-500" />
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors capitalize">
                        {c || 'Todos'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Fechas</h3>
                <div className="space-y-2">
                  <input type="datetime-local" value={filters.startAt}
                    onChange={e => setF('startAt', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="datetime-local" value={filters.endAt}
                    onChange={e => setF('endAt', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {/* Price */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Precio/día (USD)</h3>
                <div className="flex gap-2">
                  <input type="number" placeholder="Min" value={filters.minPrice}
                    onChange={e => setF('minPrice', e.target.value)}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="number" placeholder="Max" value={filters.maxPrice}
                    onChange={e => setF('maxPrice', e.target.value)}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {/* With driver */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.withDriver}
                  onChange={e => setF('withDriver', e.target.checked)}
                  className="accent-indigo-500 w-4 h-4" />
                <span className="text-sm text-slate-300">Con chofer disponible</span>
              </label>
            </div>
          </aside>
        )}

        {/* Results grid */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="bg-slate-900 rounded-2xl h-64 animate-pulse border border-slate-800" />
              ))}
            </div>
          ) : vehicles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {vehicles.map(v => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <img src="/empty-state.svg" alt="Sin resultados" width={220} className="mb-4 opacity-80" />
              <p className="text-lg font-medium text-slate-400">No se encontraron vehículos</p>
              <p className="text-sm mt-1">Intenta cambiar los filtros</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
