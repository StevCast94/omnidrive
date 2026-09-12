// ===== web/src/pages/SelectorPais.tsx =====
// Elegir país. Cada país es un sitio distinto, con su propia base de datos y
// sus propias cuentas: entrar en el equivocado significa no encontrar tu
// cuenta ni los vehículos de tu zona.
//
// La sugerencia se basa en la zona horaria del navegador, que no requiere
// ningún servicio externo ni la IP de nadie. Es una sugerencia: quien esté de
// viaje debe poder entrar al suyo igual.

import { useState, useEffect } from 'react';
import { useNavigate } from '@/lib/router-exports';
import { ArrowRight, Check } from 'lucide-react';
import { usePais, type ConfigPais } from '@/lib/money';
import { Logo } from '@/components/ui/Logo';
import { recordarPais } from '@/lib/pais';

interface PaisResumen {
  code: string;
  name: string;
  flag: string;
  currency: string;
  timezone: string;
  pilotArea: string;
  siteUrl: string;
}

export default function SelectorPais() {
  const navigate = useNavigate();
  const pais = usePais(s => s.pais) as ConfigPais & { paises?: PaisResumen[]; siteUrl?: string };
  const paises = pais.paises ?? [];

  // vehículos disponibles por país, o null mientras carga / si no responde
  const [conteos, setConteos] = useState<Record<string, number | null>>({});

  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const sugerido = paises.find(p => p.timezone === zona)?.code;

  useEffect(() => {
    // Cada país sirve sus propias métricas públicas. Si uno no responde, su
    // tarjeta se muestra igual, sin el conteo: nunca se oculta un país por un
    // fallo de red.
    for (const p of paises) {
      fetch(`${p.siteUrl}/api/metrics/public`)
        .then(r => r.json())
        .then(j => setConteos(c => ({ ...c, [p.code]: j?.data?.vehicles_active ?? null })))
        .catch(() => setConteos(c => ({ ...c, [p.code]: null })));
    }
  }, [paises.length]);

  const elegir = (p: PaisResumen) => {
    recordarPais(p.code);
    // Si ya estamos en ese país, no hay que salir a la red.
    if (p.code === pais.code) navigate('/');
    else window.location.href = p.siteUrl;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <Logo variant="icon" className="mx-auto mb-5" />
          <h1 className="text-3xl font-bold text-white">¿Desde dónde alquilas?</h1>
          <p className="text-slate-400 mt-3 text-sm max-w-md mx-auto">
            Cada país tiene su propia comunidad de anfitriones, sus precios y su moneda.
            Puedes cambiar cuando quieras desde el pie de página.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {paises.map(p => {
            const esSugerido = p.code === sugerido;
            const n = conteos[p.code];

            return (
              <button
                key={p.code}
                onClick={() => elegir(p)}
                className={`group relative text-left bg-slate-900 border rounded-2xl p-6 transition-colors ${
                  esSugerido
                    ? 'border-cyan-500/60 hover:border-cyan-400'
                    : 'border-slate-800 hover:border-slate-600'
                }`}
              >
                {esSugerido && (
                  <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-400">
                    <Check size={12} /> Tu zona
                  </span>
                )}

                <span className="text-4xl" aria-hidden="true">{p.flag}</span>
                <h2 className="text-lg font-bold text-white mt-3">{p.name}</h2>
                <p className="text-sm text-slate-400 mt-1">{p.pilotArea}</p>

                <p className="text-sm text-slate-500 mt-4">
                  {n === undefined
                    ? 'Cargando…'
                    : n === null
                      ? `Precios en ${p.currency}`
                      : n === 0
                        ? `Estamos incorporando los primeros vehículos · ${p.currency}`
                        : `${n} vehículo${n !== 1 ? 's' : ''} disponible${n !== 1 ? 's' : ''} · ${p.currency}`}
                </p>

                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-400 mt-5 group-hover:gap-2.5 transition-all">
                  Entrar <ArrowRight size={15} />
                </span>
              </button>
            );
          })}
        </div>

        {paises.length === 0 && (
          <p className="text-center text-slate-500 text-sm">Cargando países…</p>
        )}
      </div>
    </div>
  );
}
