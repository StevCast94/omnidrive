// ===== components/FondoHero.tsx =====
// El fondo del hero: 4 fotos por país que rotan con un fundido lento.
//
// Antes había una sola foto fija (un cañón que no es de ningún país del
// piloto). Ahora cada país tiene su propio set — el mismo componente,
// distintas imágenes según `pais.code` — así que RD no ve paisajes de
// Ecuador ni al revés.
//
// Las dos capas de <img> se turnan para quedar "encima": la que entra sube
// de opacidad mientras la anterior baja, en vez de que una reemplace a la
// otra de golpe (eso se notaría como un parpadeo). `key` fuerza a React a
// montar una imagen nueva por índice en vez de reciclar el <img>, así el
// navegador dispara la transición de opacidad de verdad.

import { useEffect, useRef, useState } from 'react';

const FOTOS: Record<string, string[]> = {
  EC: ['/hero/ec-1.jpg', '/hero/ec-2.jpg', '/hero/ec-3.jpg', '/hero/ec-4.jpg'],
  DO: ['/hero/do-1.jpg', '/hero/do-2.jpg', '/hero/do-3.jpg', '/hero/do-4.jpg'],
};

const DURACION_MS = 9000;

export default function FondoHero({ paisCode }: { paisCode: string }) {
  const fotos = FOTOS[paisCode] ?? FOTOS.EC;
  const [indice, setIndice] = useState(0);
  const reducido = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    setIndice(0); // al cambiar de país (selector), vuelve a empezar su set
    if (reducido.current || fotos.length <= 1) return;
    const t = setInterval(() => setIndice(i => (i + 1) % fotos.length), DURACION_MS);
    return () => clearInterval(t);
  }, [paisCode, fotos.length]);

  // Con "reducir movimiento" activado, se queda quieta en la primera: nada
  // de fundidos, pero tampoco una foto congelada a medio parpadeo.
  if (reducido.current) {
    return (
      <img
        src={fotos[0]}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    );
  }

  return (
    <>
      {fotos.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center scale-105 animate-[float_18s_ease-in-out_infinite] transition-opacity duration-[1800ms] ease-in-out"
          style={{ opacity: i === indice ? 1 : 0 }}
          // La primera se pide con prioridad (LCP del hero); el resto, perezosas.
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'low'}
        />
      ))}
    </>
  );
}
