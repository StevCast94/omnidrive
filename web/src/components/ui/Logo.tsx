// src/components/ui/Logo.tsx
import React from 'react';

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'icon' | 'full' | 'horizontal';
  /** La rueda entra rodando al montar. */
  animated?: boolean;
}

/**
 * Isotipo OmniDrive — el de la marca, no una reinterpretación.
 *
 * Son dos formas: la "O", que es una rueda, y la "D" abierta que la abraza.
 * De ahí sale la animación: al entrar, la rueda RUEDA — se desplaza girando,
 * como rueda una rueda de verdad, y la "D" aparece detrás. Es un movimiento
 * que sólo tiene sentido en esta marca; un fundido o un giro suelto valdrían
 * para cualquier logo.
 *
 * Trazado original del archivo de marca (viewBox 210.17 × 129.55).
 */
export const LogoMark: React.FC<{ className?: string; animated?: boolean }> = ({
  className = '',
  animated = false,
}) => (
  <svg
    viewBox="0 0 210.17 129.55"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="OmniDrive"
    className={`w-full h-full ${className}`}
  >
    {/* La "D": aparece un instante después de que la rueda llega a su sitio. */}
    <path
      className={animated ? 'omni-d' : ''}
      fill="currentColor"
      d="M132.57,47.83l-1.48-.28c-3.27-13.51-11.06-25.53-21.33-34.74l-13.18-9.13,53.54-.02c56.68,4.92,76.86,78.1,29.65,111.29-16.98,11.94-29.73,10.72-49.33,10.63-11.44-.06-22.9.09-34.34.01l11.27-7.2c11.57-9.36,20.63-22.23,23.77-36.95h1.44v24h18c18.96,0,35.28-22.77,35.28-40.56,0-18.34-16.2-41.04-35.76-41.04h-17.52v24Z"
    />

    {/* La rueda. El origen de la rotación es su centro, para que gire sobre sí
        misma y no orbite alrededor de la esquina del lienzo. */}
    <path
      className={animated ? 'omni-rueda' : ''}
      style={{ transformOrigin: '65.65px 64.65px' }}
      fill="currentColor"
      d="M65.65,3.65C31.97,3.65,4.66,30.96,4.66,64.65s27.31,61,61,61,61-27.31,61-61S99.34,3.65,65.65,3.65ZM65.65,105.29c-22.44,0-40.64-18.2-40.64-40.64s18.2-40.64,40.64-40.64,40.64,18.2,40.64,40.64-18.2,40.64-40.64,40.64Z"
    />
  </svg>
);

export const Logo: React.FC<LogoProps> = ({ variant = 'full', animated = false, className = '', ...props }) => {
  const marca = <LogoMark animated={animated} className="text-[#00b1ff]" />;

  if (variant === 'icon') {
    return (
      <div className={`w-11 h-11 ${className}`} {...props}>
        {marca}
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`} {...props}>
        <div className="w-10 shrink-0">{marca}</div>
        <span className="text-xl font-bold tracking-tight text-white">
          Omni<span className="text-[#00b1ff]">Drive</span>
        </span>
      </div>
    );
  }

  // Vertical
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`} {...props}>
      <div className="w-20">{marca}</div>
      <span className="text-2xl font-bold tracking-tight text-white">
        Omni<span className="text-[#00b1ff]">Drive</span>
      </span>
    </div>
  );
};
