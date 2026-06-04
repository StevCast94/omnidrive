// src/components/AnimatedCounter.tsx
import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  /** Valor final al que cuenta */
  to: number;
  /** Texto antes del número (ej. "$") */
  prefix?: string;
  /** Texto después del número (ej. "+", "%") */
  suffix?: string;
  /** Decimales a mostrar (ej. 1 para 4.9) */
  decimals?: number;
  /** Duración de la animación en ms */
  duration?: number;
  className?: string;
}

/**
 * Cuenta de 0 → `to` cuando el elemento entra en viewport.
 * Solo CSS/JS nativo (IntersectionObserver + rAF), sin librerías.
 */
export default function AnimatedCounter({
  to,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1600,
  className = '',
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutExpo para un final suave
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            setValue(to * eased);
            if (progress < 1) requestAnimationFrame(tick);
            else setValue(to);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
