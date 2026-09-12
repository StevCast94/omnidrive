// ===== components/AvisoPais.tsx =====
// Aviso discreto cuando la zona horaria sugiere que esta persona está en otro
// país del que tiene delante. Nunca redirige solo: ofrece, y se puede cerrar.

import { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { usePais } from '@/lib/money';
import { paisSugerido, recordarPais, descartarSugerencia } from '@/lib/pais';

export default function AvisoPais() {
  const pais = usePais(s => s.pais) as any;
  const cargado = usePais(s => s.cargado);
  const [cerrado, setCerrado] = useState(false);

  const paises: Array<{ code: string; name: string; flag: string; timezone: string; siteUrl: string }> =
    pais.paises ?? [];

  if (!cargado || cerrado || paises.length < 2) return null;

  const codigo = paisSugerido(pais.code, paises);
  if (!codigo) return null;

  const otro = paises.find(p => p.code === codigo)!;

  const cerrar = () => {
    descartarSugerencia();
    setCerrado(true);
  };

  return (
    <div className="bg-slate-900 border-b border-slate-800" role="region" aria-label="Sugerencia de país">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3 text-sm">
        <span className="text-lg" aria-hidden="true">{otro.flag}</span>

        <p className="text-slate-300 flex-1 min-w-0">
          Parece que estás en {otro.name}.{' '}
          <span className="text-slate-500">Allí tenemos otros anfitriones y otra moneda.</span>
        </p>

        <a
          href={otro.siteUrl}
          onClick={() => recordarPais(otro.code)}
          className="inline-flex items-center gap-1.5 shrink-0 font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Ir a {otro.name} <ArrowRight size={14} />
        </a>

        <button
          onClick={cerrar}
          className="shrink-0 text-slate-500 hover:text-white transition-colors"
          aria-label="Cerrar sugerencia y quedarme aquí"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
