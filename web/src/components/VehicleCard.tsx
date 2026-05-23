// ===== web/src/components/VehicleCard.tsx =====
import { Link } from '@/lib/router-exports';
import { Star, MapPin, Users, Car } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import clsx from 'clsx';

interface Props {
  vehicle: any;
  compact?: boolean;
  onClick?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  car: 'Auto',
  suv: 'SUV',
  motorcycle: 'Moto',
  van: 'Furgoneta',
  truck: 'Camioneta',
  luxury: 'Lujo',
};

const CATEGORY_COLORS: Record<string, 'cyan' | 'indigo' | 'green' | 'amber' | 'red'> = {
  car: 'cyan',
  suv: 'indigo',
  motorcycle: 'green',
  van: 'amber',
  truck: 'indigo',
  luxury: 'amber',
};

function CardContent({ v, compact }: { v: any; compact: boolean }) {
  const photo = v.photos?.[0];

  return (
    <Card
      className={clsx(
        'overflow-hidden cursor-pointer flex flex-col h-full',
        compact ? 'flex-row' : ''
      )}
    >
      {/* Image Cover */}
      <div
        className={clsx(
          'relative overflow-hidden flex-shrink-0',
          compact ? 'w-24 h-24' : 'h-48 w-full'
        )}
      >
        {photo ? (
          <img
            src={photo}
            alt={`${v.brand} ${v.model}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600">
            <Car size={compact ? 28 : 40} />
          </div>
        )}
        {/* Gradient overlay for text readability */}
        {!compact && (
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
        )}

        {/* Badge categoría */}
        <div className={clsx('absolute top-3 left-3', compact && 'hidden')}>
          <Badge variant={CATEGORY_COLORS[v.category] ?? 'cyan'}>
            {CATEGORY_LABELS[v.category] ?? v.category}
          </Badge>
        </div>

        {/* Title overlay on image for non-compact */}
        {!compact && (
          <div className="absolute bottom-3 left-3">
            <h3 className="text-lg font-bold text-white leading-tight">
              {v.brand} {v.model}
            </h3>
            <p className="text-sm text-slate-300">{v.year}</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div
        className={clsx(
          'flex-1 flex flex-col',
          compact ? 'p-3' : 'p-4'
        )}
      >
        {compact ? (
          <>
            <div className="flex items-start justify-between mb-1">
              <div>
                <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">
                  {CATEGORY_LABELS[v.category] ?? v.category}
                </span>
                <h3 className="font-semibold text-white text-sm truncate">
                  {v.brand} {v.model} {v.year}
                </h3>
              </div>
              {v.withDriver && (
                <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full flex-shrink-0">
                  Con chofer
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            {v.withDriver && (
              <div className="mb-2">
                <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">
                  Con chofer
                </span>
              </div>
            )}
          </>
        )}

        {/* Location */}
        {v.locationName && (
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
            <MapPin size={11} className="text-cyan-400" />
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
            <span className="flex items-center gap-1">
              <Users size={11} /> {v.seats} asientos
            </span>
            <span>
              {v.transmission === 'automatic' ? 'Automático' : 'Manual'}
            </span>
            <span>{v.fuelType}</span>
          </div>
        )}

        {/* Rating & Price */}
        <div
          className={clsx(
            'flex items-center justify-between',
            compact
              ? 'mt-auto'
              : 'mt-auto pt-3 border-t border-slate-800'
          )}
        >
          <div className="flex items-center gap-1">
            <Star size={13} className="text-amber-400 fill-amber-400" />
            <span className="text-xs text-slate-300 font-medium">
              {v.rating > 0 ? v.rating.toFixed(1) : 'Nuevo'}
            </span>
            {v._count?.reviews > 0 && (
              <span className="text-xs text-slate-600">
                ({v._count.reviews})
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-white">
              ${Number(v.pricePerDay).toFixed(0)}
            </span>
            <span className="text-xs text-slate-500">/día</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function VehicleCard({
  vehicle: v,
  compact = false,
  onClick,
}: Props) {
  if (onClick) {
    return (
      <div
        onClick={onClick}
        className="block group cursor-pointer"
      >
        <CardContent v={v} compact={compact} />
      </div>
    );
  }

  return (
    <Link
      to={`/vehicles/${v.id}`}
      className="block group"
    >
      <CardContent v={v} compact={compact} />
    </Link>
  );
}
