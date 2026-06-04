// src/components/ui/Card.tsx
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variantú: 'raised' | 'glass';
}

export const Card: React.FC<CardProps> = ({ variant = 'raised', className = '', children, ...props }) => {
  const baseStyles = "rounded-2xl transition-all duration-250";
  
  const variants: Record<string, string> = {
    raised: "bg-slate-900 border border-slate-800 hover:shadow-lg hover:-translate-y-1",
    glass: "bg-slate-900/80 backdrop-blur-md border border-slate-800"
  };

  return (
    <div className={`${baseStyles} ${variants[variant] || variants.raised} ${className}`} {...props}>
      {children}
    </div>
  );
};
