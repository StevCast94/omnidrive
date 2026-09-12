// ===== web/src/lib/money.ts =====
// Todo el dinero viaja de la API en centavos enteros. Estas funciones son el
// unico sitio donde se convierte a algo que lee una persona.
//
// El país lo sirve /api/metrics/config: en Ecuador son dólares, en República
// Dominicana pesos. Ningún componente debería escribir "$" a mano.

import { create } from 'zustand';

export interface ConfigPais {
  code: string;
  name: string;
  flag: string;
  locale: string;
  currency: string;
  currencySymbol: string;
  acceptedCurrencies: string[];
  taxName: string;
  taxRate: number;
  phonePrefix: string;
  mobilePrefixes: string[];
  documentTypes: Array<'cedula' | 'passport'>;
  cities: string[];
  pilotArea: string;
  dataProtectionLaw: string;
  googleEnabled: boolean;
}

// Ecuador como valor por defecto sólo hasta que llega la respuesta, para que
// el primer render no se quede en blanco.
const POR_DEFECTO: ConfigPais = {
  code: 'EC',
  name: 'Ecuador',
  flag: '🇪🇨',
  locale: 'es-EC',
  currency: 'USD',
  currencySymbol: '$',
  acceptedCurrencies: ['USD'],
  taxName: 'IVA',
  taxRate: 15,
  phonePrefix: '+593',
  mobilePrefixes: ['9'],
  documentTypes: ['cedula'],
  cities: [],
  pilotArea: '',
  dataProtectionLaw: '',
  googleEnabled: false,
};

interface EstadoPais {
  pais: ConfigPais;
  cargado: boolean;
  setPais: (p: ConfigPais) => void;
}

export const usePais = create<EstadoPais>(set => ({
  pais: POR_DEFECTO,
  cargado: false,
  setPais: pais => set({ pais, cargado: true }),
}));

/** Lee la config fuera de un componente de React. */
export function paisActual(): ConfigPais {
  return usePais.getState().pais;
}

/**
 * 12050 centavos -> "$120,50" (o "RD$120.50" según el país).
 *
 * `decimales: false` para precios redondos en tarjetas y listados, donde
 * ",00" sólo añade ruido.
 */
export function formatearDinero(
  centavos: number | null | undefined,
  opciones: { decimales?: boolean; pais?: ConfigPais } = {}
): string {
  const p = opciones.pais ?? paisActual();
  const valor = (centavos ?? 0) / 100;
  const conDecimales = opciones.decimales ?? !Number.isInteger(valor);

  return new Intl.NumberFormat(p.locale, {
    style: 'currency',
    currency: p.currency,
    minimumFractionDigits: conDecimales ? 2 : 0,
    maximumFractionDigits: conDecimales ? 2 : 0,
  }).format(valor);
}

/** Para inputs: 12050 -> "120.50" sin símbolo de moneda. */
export function centavosAInput(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '';
  return (centavos / 100).toFixed(2).replace(/\.00$/, '');
}

/**
 * Lo que escribe una persona -> centavos enteros.
 *
 * Se parsea el decimal como texto, no multiplicando por 100: 1.005 en coma
 * flotante es 1.00499… y multiplicar se come un centavo. Es la misma regla que
 * aplica el servidor, para que los dos lados coincidan siempre.
 */
export function inputACentavos(valor: string | number): number | null {
  if (valor === '' || valor === null || valor === undefined) return null;
  const texto = String(valor).trim().replace(',', '.');
  const m = /^(\d+)(?:\.(\d*))?$/.exec(texto);
  if (!m) return null;

  const decimales = (m[2] ?? '').padEnd(3, '0');
  const centavos = Number(m[1]) * 100 + Number(decimales.slice(0, 2));
  return Number(decimales[2]) >= 5 ? centavos + 1 : centavos;
}
