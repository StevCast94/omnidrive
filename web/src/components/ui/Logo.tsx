// src/components/ui/Logo.tsx
import React from 'react';

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'icon' | 'full' | 'horizontal';
}

export const Logo: React.FC<LogoProps> = ({ variant = 'full', className = '', ...props }) => {
  const Icon = () => (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="omni-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path d="M30 20 L70 20 A 20 20 0 0 1 90 40 L90 60 A 20 20 0 0 1 70 80 L30 80 A 20 20 0 0 1 10 60 L10 40 A 20 20 0 0 1 30 20 Z" stroke="url(#omni-grad)" strokeWidth="8" />
      <path d="M50 20 L50 80" stroke="url(#omni-grad)" strokeWidth="8" />
      <path d="M10 50 L90 50" stroke="#0f172a" strokeWidth="12" />
      <path d="M30 20 L70 80" stroke="url(#omni-grad)" strokeWidth="6" opacity="0.8" />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={`w-10 h-10 ${className}`} {...props}>
        <Icon />
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center gap-3 ${className}`} {...props}>
        <div className="w-10 h-10"><Icon /></div>
        <span className="text-xl font-bold tracking-tight text-white">
          Omni<span className="text-cyan-400">Drive</span>
        </span>
      </div>
    );
  }

  // Full variant (vertical)
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`} {...props}>
      <div className="w-16 h-16"><Icon /></div>
      <span className="text-2xl font-bold tracking-tight text-white">
        Omni<span className="text-cyan-400">Drive</span>
      </span>
    </div>
  );
};
