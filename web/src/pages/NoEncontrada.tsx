// ===== web/src/pages/NoEncontrada.tsx =====
// Antes, una ruta inexistente redirigía a la portada en silencio. Con las URL
// por hash eso pasaba desapercibido; con caminos reales es peor: un enlace mal
// escrito o caducado se convierte en la portada sin decir nada, y un buscador
// ve el mismo contenido en todas las direcciones.

import { useNavigate } from '@/lib/router-exports';
import { ArrowLeft, Search } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';

export default function NoEncontrada() {
  const navigate = useNavigate();
  const ruta = typeof window !== 'undefined' ? window.location.pathname : '';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-md">
        <div className="w-16 mx-auto mb-6"><LogoMark className="text-[#00b1ff] opacity-40" /></div>

        <h1 className="text-2xl font-bold text-white">Esta página no existe</h1>

        <p className="text-slate-400 mt-3 text-sm">
          No encontramos nada en <code className="text-slate-300 bg-slate-800 rounded px-1.5 py-0.5">{ruta}</code>.
          Puede que el enlace esté mal escrito, o que lo que buscabas ya no esté publicado.
        </p>

        <div className="flex flex-wrap gap-3 justify-center mt-8">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={15} /> Ir al inicio
          </button>
          <button
            onClick={() => navigate('/vehicles')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold transition-colors"
          >
            <Search size={15} /> Ver vehículos
          </button>
        </div>
      </div>
    </div>
  );
}
