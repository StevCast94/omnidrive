// ===== components/Mapa.tsx =====
// El mapa de OmniDrive. Un solo componente para los tres usos: elegir dónde
// está un vehículo, ver los vehículos cerca, y seguir un alquiler en vivo.
//
// Usa MapLibre con teselas de OpenStreetMap: sin token, sin cuenta y sin
// facturación por carga de mapa. La alternativa (Mapbox) obligaba a mantener
// una credencial más por país y a pagar por vista.

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapaGL, Marker, MapMouseEvent, StyleSpecification, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface PuntoMapa {
  id?: string;
  lat: number;
  lng: number;
  etiqueta?: string;
  /** 'vehiculo' dibuja un pin; 'actual' el marcador en movimiento. */
  tipo?: 'vehiculo' | 'actual' | 'origen';
  onClick?: () => void;
}

interface Props {
  centro?: { lat: number; lng: number };
  zoom?: number;
  puntos?: PuntoMapa[];
  /** Traza del recorrido, en orden. */
  recorrido?: Array<{ lat: number; lng: number }>;
  /** Círculo de la geocerca. */
  zona?: { lat: number; lng: number; radioKm: number } | null;
  /** Si se pasa, el mapa deja elegir un punto haciendo clic. */
  onElegirPunto?: (p: { lat: number; lng: number }) => void;
  alto?: string;
  className?: string;
}

// Centro por defecto: la península de Santa Elena, que es donde está el
// inventario real del piloto.
const CENTRO_POR_DEFECTO = { lat: -2.2145, lng: -80.9584 };

const ESTILO: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

function crearPin(punto: PuntoMapa): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', punto.etiqueta ?? 'Punto en el mapa');

  const colores = {
    vehiculo: { fondo: '#0891b2', borde: '#ffffff' },
    actual: { fondo: '#22c55e', borde: '#ffffff' },
    origen: { fondo: '#64748b', borde: '#ffffff' },
  };
  const c = colores[punto.tipo ?? 'vehiculo'];

  el.style.cssText = `
    width: 22px; height: 22px; border-radius: 999px;
    background: ${c.fondo}; border: 3px solid ${c.borde};
    box-shadow: 0 1px 6px rgba(0,0,0,.45);
    cursor: ${punto.onClick ? 'pointer' : 'default'};
    padding: 0;
  `;

  // El marcador en movimiento late, para que se distinga de un pin fijo.
  if (punto.tipo === 'actual') {
    el.animate(
      [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.25)', opacity: .75 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 1800, iterations: Infinity }
    );
  }

  if (punto.onClick) el.addEventListener('click', punto.onClick);
  return el;
}

/** Círculo geodésico, en GeoJSON, para dibujar la geocerca. */
function circulo(lat: number, lng: number, radioKm: number, lados = 64) {
  const coords: [number, number][] = [];
  const kmPorGradoLat = 110.574;
  const kmPorGradoLng = 111.320 * Math.cos((lat * Math.PI) / 180);

  for (let i = 0; i <= lados; i++) {
    const t = (i / lados) * 2 * Math.PI;
    coords.push([lng + (radioKm / kmPorGradoLng) * Math.cos(t), lat + (radioKm / kmPorGradoLat) * Math.sin(t)]);
  }
  return { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [coords] }, properties: {} };
}

export default function Mapa({
  centro, zoom = 12, puntos = [], recorrido, zona, onElegirPunto,
  alto = '360px', className = '',
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaGL | null>(null);
  const marcadores = useRef<Marker[]>([]);
  const [listo, setListo] = useState(false);

  // El callback vive en una ref: el mapa se crea una vez y no debe quedarse
  // con una versión vieja de la función.
  const alElegir = useRef(onElegirPunto);
  alElegir.current = onElegirPunto;

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      center: [centro?.lng ?? CENTRO_POR_DEFECTO.lng, centro?.lat ?? CENTRO_POR_DEFECTO.lat],
      zoom,
      attributionControl: { compact: true },
    });

    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => setListo(true));
    m.on('click', (e: MapMouseEvent) => alElegir.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));

    mapa.current = m;
    return () => { m.remove(); mapa.current = null; };
  }, []);

  // Marcadores
  useEffect(() => {
    if (!mapa.current || !listo) return;

    marcadores.current.forEach(m => m.remove());
    marcadores.current = puntos.map(p =>
      new maplibregl.Marker({ element: crearPin(p) })
        .setLngLat([p.lng, p.lat])
        .addTo(mapa.current!)
    );
  }, [puntos, listo]);

  // Recorrido
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;

    const datos = {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: (recorrido ?? []).map(p => [p.lng, p.lat]) },
      properties: {},
    };

    const fuente = m.getSource('recorrido') as GeoJSONSource | undefined;
    if (fuente) {
      fuente.setData(datos);
    } else if (recorrido?.length) {
      m.addSource('recorrido', { type: 'geojson', data: datos });
      m.addLayer({
        id: 'recorrido',
        type: 'line',
        source: 'recorrido',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#22c55e', 'line-width': 4, 'line-opacity': 0.85 },
      });
    }
  }, [recorrido, listo]);

  // Geocerca
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;

    const datos = zona
      ? circulo(zona.lat, zona.lng, zona.radioKm)
      : { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [[]] }, properties: {} };

    const fuente = m.getSource('zona') as GeoJSONSource | undefined;
    if (fuente) {
      fuente.setData(datos);
    } else if (zona) {
      m.addSource('zona', { type: 'geojson', data: datos });
      m.addLayer({ id: 'zona-relleno', type: 'fill', source: 'zona', paint: { 'fill-color': '#0891b2', 'fill-opacity': 0.1 } });
      m.addLayer({ id: 'zona-borde', type: 'line', source: 'zona', paint: { 'line-color': '#0891b2', 'line-width': 2, 'line-dasharray': [2, 2] } });
    }
  }, [zona, listo]);

  // Seguir el centro cuando cambia (marcador en vivo)
  useEffect(() => {
    if (mapa.current && listo && centro) {
      mapa.current.easeTo({ center: [centro.lng, centro.lat], duration: 900 });
    }
  }, [centro?.lat, centro?.lng, listo]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-800 ${className}`} style={{ height: alto }}>
      <div ref={contenedor} className="absolute inset-0" />
      {onElegirPunto && (
        <p className="absolute top-3 left-3 z-10 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 pointer-events-none">
          Toca el mapa para marcar dónde está el vehículo
        </p>
      )}
    </div>
  );
}
