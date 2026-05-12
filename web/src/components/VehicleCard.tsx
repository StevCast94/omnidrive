import { useNavigate, useParams, Link } from '@/lib/router-exports';
import { Star, MapPin, Users, Car } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  vehicle: any;
  compact?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  car: 'Auto', suv: 'SUV', motorcycle: 'Moto',
  van: 'Furgoneta', truck: 'Camioneta', luxury: 'Lujo',
};

export default function VehicleCard({ vehicle: v, compact = false }: Props) {
  const photo = v.photos?.[0];

  return (
    <Link to={`/vehicles/${v.id}`} className={clsx(
      'group bg-slate-900 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-all overflow-hidden',
      compact ? 'flex gap-3 p-3' : 'flex flex-col'
    )}>
      {/* Image */}
      <div className={clsx(
        'bg-slate-800 overflow-hidden flex-shrink-0',
        compact ? 'w-24 h-24 rounded-xl' : 'h-48 w-full'
      )}>
        {photo ? (
          <img src={photo} alt={`${v.brand} ${v.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <Car size={compact ? 28 : 40} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className={clsx('flex-1', compact ? '' : 'p-4')}>
        {/* Category badge */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-indigo-400 uppercase tracking-wide">
            {CATEGORY_LABELS[v.category] ?? v.category}
          </span>
          {v.withDriver && (
            <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">Con chofer</span>
          )}
        </div>

        <h3 className="font-semibold text-white text-sm mb-1 truncate">
          {v.brand} {v.model} {v.year}
        </h3>

        {/* Location */}
        {v.locationName && (
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
            <MapPin size={11} />
            <span className="truncate">{v.locationName}</span>
            {(v as any).distance !== undefined && (
              <span className="ml-auto flex-shrink-0 text-slate-600">
                {((v as any).distance).toFixed(1)} km
              </span>
            )}
          </div>
        )}

        {!compact && (
          <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
            <span className="flex items-center gap-1"><Users size={11} /> {v.seats} asientos</span>
            <span>{v.transmission === 'automatic' ? 'Automático' : 'Manual'}</span>
            <span>{v.fuelType}</span>
          </div>
        )}

        {/* Rating & Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star size={13} className="text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-slate-300 font-medium">
              {v.rating > 0 ? v.rating.toFixed(1) : 'Nuevo'}
            </span>
            {v._count?.reviews > 0 && (
              <span className="text-xs text-slate-600">({v._count.reviews})</span>
            )}
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-white">${Number(v.pricePerDay).toFixed(0)}</span>
            <span className="text-xs text-slate-500">/día</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
