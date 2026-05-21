// src/components/ui/Input.tsx
import React, { useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, required, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = props.value !== undefined && props.value !== '' && props.value !== null;

    return (
      <div className={`relative w-full ${className}`}>
        <div className={`
          relative border rounded-xl bg-slate-800 transition-all duration-250
          ${error ? 'border-red-500' : isFocused ? 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)]' : 'border-slate-700'}
        `}>
          <label className={`
            absolute left-4 transition-all duration-250 pointer-events-none
            ${isFocused || hasValue ? 'text-xs top-2 text-cyan-400' : 'text-sm top-3.5 text-slate-500'}
          `}>
            {label} {required && '*'}
          </label>
          <input
            ref={ref}
            className="w-full bg-transparent px-4 pt-6 pb-2 text-white outline-none text-sm"
            onFocus={(e) => { setIsFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setIsFocused(false); props.onBlur?.(e); }}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
