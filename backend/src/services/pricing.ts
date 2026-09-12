// ===== services/pricing.ts =====
// Todo el cálculo de precios de la plataforma, en centavos enteros.
//
// Vive aparte y con tests porque la versión anterior tenía la condición
// invertida y cobraba SIEMPRE la opción más cara: con las tarifas reales de
// un vehículo ($10/hora, $120/día), un alquiler de 24 h cobraba $240.

export interface Duracion {
  horas: number;
  dias: number;
}

export function calcularDuracion(inicio: Date, fin: Date): Duracion {
  const ms = fin.getTime() - inicio.getTime();
  const horas = ms / (1000 * 60 * 60);
  return { horas, dias: horas / 24 };
}

export interface TarifasVehiculo {
  /** Centavos por hora. */
  pricePerHour: number;
  /** Centavos por día. */
  pricePerDay: number;
  /** Centavos por día de chofer. */
  driverPrice?: number | null;
  /** Centavos retenidos como garantía. */
  deposit: number;
}

export interface DesgloseReserva {
  baseAmount: number;
  driverFee: number;
  insuranceFee: number;
  serviceFee: number;
  totalAmount: number;
  deposit: number;
  /** Qué tarifa se aplicó, para poder explicárselo al usuario. */
  tarifaAplicada: 'horas' | 'dias';
  horasCobradas: number;
  diasCobrados: number;
}

/**
 * Importe base del alquiler, en centavos.
 *
 * Regla: se cobra **la más barata** de las dos tarifas del propio dueño —
 * horas completas o días completos. Siempre a favor del arrendatario, y fácil
 * de explicar: "te aplicamos la tarifa que te sale mejor".
 */
export function calcularBase(
  pricePerHour: number,
  pricePerDay: number,
  duracion: Duracion
): { centavos: number; tarifa: 'horas' | 'dias'; horas: number; dias: number } {
  // Nadie alquila "cero horas": el mínimo facturable es una hora.
  const horas = Math.max(1, Math.ceil(duracion.horas));
  const dias = Math.max(1, Math.ceil(duracion.dias));

  const porHoras = horas * pricePerHour;
  const porDias = dias * pricePerDay;

  return porDias <= porHoras
    ? { centavos: porDias, tarifa: 'dias', horas, dias }
    : { centavos: porHoras, tarifa: 'horas', horas, dias };
}

/**
 * Desglose completo de una reserva, en centavos.
 *
 * `comisionPorMil` es la comisión de la plataforma en partes por mil (25 = 2,5%).
 * Hoy es 0: el modelo elegido no cobra comisión sobre el alquiler hasta F8.
 */
export function calcularReserva(
  tarifas: TarifasVehiculo,
  duracion: Duracion,
  opciones: { conChofer?: boolean; comisionPorMil?: number } = {}
): DesgloseReserva {
  const base = calcularBase(tarifas.pricePerHour, tarifas.pricePerDay, duracion);

  // El chofer se cobra por día empezado, no por hora.
  const driverFee = opciones.conChofer ? (tarifas.driverPrice ?? 0) * base.dias : 0;

  const subtotal = base.centavos + driverFee;
  const serviceFee = Math.round((subtotal * (opciones.comisionPorMil ?? 0)) / 1000);

  return {
    baseAmount: base.centavos,
    driverFee,
    insuranceFee: 0,
    serviceFee,
    totalAmount: subtotal + serviceFee,
    deposit: tarifas.deposit,
    tarifaAplicada: base.tarifa,
    horasCobradas: base.horas,
    diasCobrados: base.dias,
  };
}

// ── Conversión en los bordes ──────────────────────────────────────────
// Dentro del sistema todo es centavos. Estas funciones existen solo para
// hablar con el exterior (formularios, importaciones).

/** "120.50" o 120.5 -> 12050 centavos. Devuelve null si no es un importe válido. */
export function aCentavos(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number' && !Number.isFinite(valor)) return null;

  // Se parsea el decimal como TEXTO en vez de multiplicar por 100. Multiplicar
  // pierde centavos: 1.005 en coma flotante es 1.00499…, y 1.005 * 100 da
  // 100.499…, que redondea a 100 y se come un centavo. El texto es exacto.
  // Para un número, String() da la representación más corta que round-trippea,
  // que es justo lo que la persona escribió.
  const texto = String(valor).trim().replace(',', '.');
  const m = /^(\d+)(?:\.(\d*))?$/.exec(texto);
  if (!m) return null;

  const enteros = m[1];
  // Se trunca a partir del tercer decimal, pero mirando el tercero para
  // redondear el segundo: "1.005" -> 101, no 100.
  const decimales = (m[2] ?? '').padEnd(3, '0');
  const centavos = Number(enteros) * 100 + Number(decimales.slice(0, 2));
  const tercero = Number(decimales[2]);

  return tercero >= 5 ? centavos + 1 : centavos;
}

/** 12050 centavos -> 120.5, para mostrar. */
export function aUnidades(centavos: number): number {
  return centavos / 100;
}
