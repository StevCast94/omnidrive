import { useState, useRef, useEffect } from 'react';

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
  const ref = useRef<HTMLDivElement>(null);

  // Extract prefix and local number
  const detected = countryCodes.find(c => value.startsWith(c.prefix));
  const current = detected ?? countryCodes[0]; // default Ecuador
  const local = detected ? value.slice(detected.prefix.length) : value;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCountry = (cc: CountryCode) => {
    setOpen(false);
    // Keep the local number part, just change prefix
    onChange(cc.prefix + local);
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, ''); // only digits
    if (raw.length > 10) raw = raw.slice(0, 10);  // max 10 digits local

    // Format as "99 000 0000" or "99 000 000"
    let formatted = raw;
    if (raw.length > 3) formatted = raw.slice(0, 3) + ' ' + raw.slice(3);
    if (raw.length > 7) formatted = raw.slice(0, 3) + ' ' + raw.slice(3, 7) + ' ' + raw.slice(7);

    onChange(current.prefix + raw);
    // The input displays the formatted version, but value stored is always digits
    e.target.value = formatted;
  };

  const displayValue = (() => {
    if (local.length > 3) return local.slice(0, 3) + ' ' + local.slice(3, 7) + (local.length > 7 ? ' ' + local.slice(7) : '');
    return local;
  })();

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Teléfono {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        {/* Country selector */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={disabled}
          className="flex items-center gap-1 px-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          <span className="text-lg">{current.flag}</span>
          <span>{current.prefix}</span>
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Local number input */}
        <input
          type="tel"
          value={displayValue}
          onChange={handleLocalChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="flex-1 px-3 py-2 outline-none text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 disabled:opacity-50"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {countryCodes.map(cc => (
            <button
              key={cc.code}
              type="button"
              onClick={() => selectCountry(cc)}
              className={`flex items-center gap-3 w-full px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${cc.code === current.code ? 'bg-blue-50 dark:bg-gray-700 font-medium' : ''}`}
            >
              <span className="text-lg">{cc.flag}</span>
              <span className="text-gray-900 dark:text-white">{cc.name}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-auto">{cc.prefix}</span>
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
  // Already E.164? return as-is
  if (/^\+[1-9]\d{6,14}$/.test(cleaned)) return cleaned;
  // If starts with 00, convert to +
  if (/^00/.test(cleaned)) return '+' + cleaned.slice(2);
  // Unknown format — return as-is, backend will handle
  return cleaned;
}
