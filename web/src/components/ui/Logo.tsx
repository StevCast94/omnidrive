// src/components/ui/Logo.tsx
import React from 'react';

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variantú: 'icon' | 'full' | 'horizontal';
  /** Si true, el isotipo gira sutilmente en hover (orbital) */
  animated?: boolean;
}

/**
 * Isotipo OmniDrive
 * Concepto: orbital (Omni = todas las direcciones) formado por dos arcos en
 * gradiente cyan→indigo. Los dos nodos en los extremos representan la comunidad
 * (dueño + arrendatario que se conectan). El chevron central comunica avance/Drive.
 * Funciona solo (favicon/app icon) y acompañado del wordmark.
 */
export const LogoMark: React.FC<{ className?: string; animated?: boolean }> = ({
  className = '',
  animated = false,
}) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-full h-full ${animated ? 'transition-transform duration-700 ease-out group-hover:rotate-[18deg]' : ''} ${className}`}
  >
    <defs>
      <linearGradient id="omni-grad" x1="10%" y1="0%" x2="90%" y2="100%">
        <stop offset="0%" stopColor="#22d3ee" />
        <stop offset="55%" stopColor="#06b6d4" />
        <stop offset="100%" stopColor="#6366f1" />
      </linearGradient>
    </defs>

    {/* Orbital — dos arcos opuestos (movilidad en todas las direcciones) */}
    <path
      d="M63 14 A 38 38 0 0 1 86 63"
      stroke="url(#omni-grad)"
      strokeWidth="9"
      strokeLinecap="round"
    />
    <path
      d="M37 86 A 38 38 0 0 1 14 37"
      stroke="url(#omni-grad)"
      strokeWidth="9"
      strokeLinecap="round"
    />

    {/* Nodos de comunidad — dueño y arrendatario que se conectan */}
    <circle cx="23" cy="23" r="6.5" fill="url(#omni-grad)" />
    <circle cx="77" cy="77" r="6.5" fill="url(#omni-grad)" />

    {/* Chevron de avance — Drive / movimiento hacia adelante */}
    <path
      d="M41 35 L59 50 L41 65"
      stroke="url(#omni-grad)"
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Logo: React.FC<LogoProps> = ({ variant = 'full', animated = false, className = '', ...props }) => {
  if (variant === 'icon') {
    return (
      <div className={`w-10 h-10 group ${className}`} {...props}>
        <LogoMark animated={animated} />
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center gap-2.5 group ${className}`} {...props}>
        <div className="w-9 h-9 shrink-0">
          <LogoMark animated={animated} />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">
          Omni<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Drive</span>
        </span>
      </div>
    );
  }

  // Full (vertical)
  return (
    <div className={`flex flex-col items-center gap-3 group ${className}`} {...props}>
      <div className="w-16 h-16">
        <LogoMark animated={animated} />
      </div>
      <span className="text-2xl font-bold tracking-tight text-white">
        Omni<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Drive</span>
      </span>
    </div>
  );
};
