// ===== web/src/pages/Legal.tsx =====
// Términos, privacidad y política de cancelación del país.
//
// Son públicos a propósito: hay que poder leerlos antes de registrarse, no
// después de aceptarlos.

import { useState, useEffect } from 'react';
import { useParams } from '@/lib/router-exports';
import { legal } from '@/lib/api';
import { usePais } from '@/lib/money';

interface Documento {
  tipo: string;
  titulo: string;
  version: string;
  actualizado: string;
  contenido: string;
}

const ORDEN = ['terminos', 'privacidad', 'cancelacion'];

/** Markdown mínimo: ## para títulos, **negrita**, y párrafos. */
function Contenido({ texto }: { texto: string }) {
  return (
    <>
      {texto.split('\n\n').map((bloque, i) => {
        const limpio = bloque.trim();
        if (!limpio) return null;

        if (limpio.startsWith('## ')) {
          return (
            <h3 key={i} className="text-lg font-semibold text-white mt-8 mb-3 first:mt-0">
              {limpio.slice(3)}
            </h3>
          );
        }

        if (limpio.startsWith('- ')) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5 my-3 text-slate-300">
              {limpio.split('\n').map((li, j) => (
                <li key={j}><Negritas texto={li.replace(/^-\s*/, '')} /></li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="text-slate-300 leading-relaxed my-3">
            <Negritas texto={limpio} />
          </p>
        );
      })}
    </>
  );
}

function Negritas({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
        parte.startsWith('**') && parte.endsWith('**')
          ? <strong key={i} className="text-white font-semibold">{parte.slice(2, -2)}</strong>
          : <span key={i}>{parte}</span>
      )}
    </>
  );
}

export default function Legal() {
  const { tipo } = useParams();
  const pais = usePais(s => s.pais);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [activo, setActivo] = useState<string>(tipo || 'terminos');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    legal.todos()
      .then(r => setDocs(r.data.data.documentos))
      .catch(() => setDocs([]))
      .finally(() => setCargando(false));
  }, []);

  const doc = docs.find(d => d.tipo === activo);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <p className="text-sm text-slate-500 mb-2">
        <span aria-hidden="true">{pais.flag}</span> OmniDrive {pais.name}
      </p>

      <nav className="flex flex-wrap gap-2 mb-8 border-b border-slate-800 pb-4">
        {ORDEN.map(t => {
          const d = docs.find(x => x.tipo === t);
          return (
            <button
              key={t}
              onClick={() => setActivo(t)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                activo === t
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {d?.titulo ?? t}
            </button>
          );
        })}
      </nav>

      {cargando ? (
        <p className="text-slate-500">Cargando…</p>
      ) : !doc ? (
        <p className="text-slate-500">No pudimos cargar el documento.</p>
      ) : (
        <article>
          <h1 className="text-3xl font-bold text-white">{doc.titulo}</h1>
          <p className="text-xs text-slate-500 mt-2 mb-8">
            Versión {doc.version} · actualizado el {doc.actualizado}
          </p>
          <Contenido texto={doc.contenido} />
        </article>
      )}
    </div>
  );
}
