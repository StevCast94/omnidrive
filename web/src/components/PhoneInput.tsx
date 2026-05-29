import { useState, useRef, useEffect, useCallback } from 'react';

interface CountryCode {
  code: string;
  prefix: string;
  name: string;
  flag: string;
}

const countryCodes: CountryCode[] = [
  { code: 'EC', prefix: '+593', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'CO', prefix: '+57',  name: 'Colombia', flag: '🇨🇴' },
  { code: 'PE', prefix: '+51',  name: 'Perú', flag: '🇵🇪' },
  { code: 'MX', prefix: '+52',  name: 'México', flag: '🇲🇽' },
  { code: 'AR', prefix: '+54',  name: 'Argentina', flag: '🇦🇷' },
  { code: 'CL', prefix: '+56',  name: 'Chile', flag: '🇨🇱' },
  { code: 'US', prefix: '+1',   name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'DO', prefix: '+1',   name: 'República Dominicana', flag: '🇩🇴' },
  { code: 'ES', prefix: '+34',  name: 'España', flag: '🇪🇸' },
];

interface PhoneInputProps {
  value: string;          // full E.164 phone like +593969369398
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export function PhoneInput({ value, onChange, placeholder = '99 000 0000', required, className, disabled }: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);

  // Extract prefix and local number
  const detected = countryCodes.find(c => value.startsWith(c.prefix));
  const current = detected ?? countryCodes[0];
  const local = detected ? value.slice(detected.prefix.length) : value;

  // Sincronizar displayText cuando cambia value externamente
  useEffect(() => {
    setDisplayText(formatLocal(local));
  }, [value]);

  // Restaurar cursor después del render
  useEffect(() => {
    if (cursorRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
      cursorRef.current = null;
    }
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function formatLocal(raw: string): string {
    if (raw.length > 3) {
      let f = raw.slice(0, 3) + ' ' + raw.slice(3, 7);
      if (raw.length > 7) f += ' ' + raw.slice(7, 10);
      return f;
    }
    return raw;
  }

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const limited = raw.slice(0, 10);
    
    // Calcular nueva posición del cursor
    // Queremos que el cursor se quede donde el usuario hizo clic, no al final
    const selStart = e.target.selectionStart ?? limited.length;
    
    // Contar dígitos antes de la posición del cursor en el texto mostrado
    const displayedBefore = e.target.value.slice(0, selStart);
    const digitsBefore = displayedBefore.replace(/\D/g, '').length;
    
    // El cursor debe ir después del mismo número de dígitos en el nuevo formateo
    const formatted = formatLocal(limited);
    let newCursorPos = 0;
    let digitCount = 0;
    for (let i = 0; i < formatted.length && digitCount < digitsBefore; i++) {
      newCursorPos = i + 1;
      if (formatted[i] >= '0' && formatted[i] <= '9') digitCount++;
    }
    // Avanzar hasta después del último dígito contado
    if (digitsBefore > 0) {
      while (newCursorPos < formatted.length && formatted[newCursorPos] >= '0' && formatted[newCursorPos] <= '9') {
        newCursorPos++;
      }
    }
    cursorRef.current = newCursorPos;
    
    setDisplayText(formatted);
    onChange(current.prefix + limited);
  }, [current.prefix, onChange]);

  const selectCountry = (cc: CountryCode) => {
    setOpen(false);
    onChange(cc.prefix + local);
  };

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        Teléfono {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex rounded-xl border border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-cyan-500 bg-slate-800">
        {/* Country selector */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={disabled}
          className="flex items-center gap-1 px-3 bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 transition-colors disabled:opacity-50"
        >
          <span className="text-lg leading-none">{current.flag}</span>
          <span>{current.prefix}</span>
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Local number input */}
        <input
          ref={inputRef}
          type="tel"
          value={displayText}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="tel-national"
          className="flex-1 px-4 py-3 outline-none text-white bg-transparent placeholder-slate-500 disabled:opacity-50 text-sm"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {countryCodes.map(cc => (
            <button
              key={cc.code}
              type="button"
              onClick={() => selectCountry(cc)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm hover:bg-slate-700 transition-colors ${
                cc.code === current.code ? 'bg-slate-700 font-medium text-cyan-400' : 'text-slate-200'
              }`}
            >
              <span className="text-lg leading-none">{cc.flag}</span>
              <span>{cc.name}</span>
              <span className="text-slate-400 ml-auto">{cc.prefix}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Parse phone to E.164 or null */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/\s/g, '');
  if (/^\+[1-9]\d{6,14}$/.test(cleaned)) return cleaned;
  if (/^00/.test(cleaned)) return '+' + cleaned.slice(2);
  return cleaned;
}
