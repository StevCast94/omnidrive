import { describe, it, expect } from 'vitest';
import {
  calcularDuracion,
  calcularBase,
  calcularReserva,
  aCentavos,
  aUnidades,
} from './pricing';

const horas = (n: number) => calcularDuracion(new Date(0), new Date(n * 3600_000));

// Tarifas reales de un vehículo que estuvo publicado: $10/hora, $120/día.
const HORA = 1000;   // centavos
const DIA = 12000;   // centavos

describe('calcularBase', () => {
  it('cobra por horas cuando el alquiler es corto', () => {
    const r = calcularBase(HORA, DIA, horas(3));
    expect(r.centavos).toBe(3 * HORA);
    expect(r.tarifa).toBe('horas');
  });

  it('REGRESIÓN: 24 h con $10/h y $120/día cobra $120, no $240', () => {
    // La versión anterior tenía la condición invertida y devolvía 24 * HORA.
    // Es el bug que cobraba el doble a cualquier alquiler de un día o más.
    const r = calcularBase(HORA, DIA, horas(24));
    expect(r.centavos).toBe(DIA);
    expect(r.tarifa).toBe('dias');
  });

  it('REGRESIÓN: 72 h cobra 3 días, no 72 horas', () => {
    expect(calcularBase(HORA, DIA, horas(72)).centavos).toBe(3 * DIA);
  });

  it('nunca cobra más que la más barata de las dos tarifas', () => {
    for (const h of [1, 2, 5, 11, 12, 13, 23, 24, 25, 47, 48, 100, 240]) {
      const r = calcularBase(HORA, DIA, horas(h));
      const porHoras = Math.max(1, Math.ceil(h)) * HORA;
      const porDias = Math.max(1, Math.ceil(h / 24)) * DIA;
      expect(r.centavos).toBe(Math.min(porHoras, porDias));
    }
  });

  it('cobra al menos una hora aunque la duración sea ridícula', () => {
    expect(calcularBase(HORA, DIA, horas(0)).centavos).toBe(HORA);
    expect(calcularBase(HORA, DIA, horas(0.1)).centavos).toBe(HORA);
  });

  it('cobra horas empezadas, no fracciones', () => {
    expect(calcularBase(HORA, DIA, horas(2.1)).centavos).toBe(3 * HORA);
  });

  it('con tarifa diaria muy barata, un alquiler de horas ya usa el día', () => {
    // $10/hora y $15/día: a partir de 2 h sale mejor el día.
    expect(calcularBase(1000, 1500, horas(2)).centavos).toBe(1500);
    expect(calcularBase(1000, 1500, horas(1)).centavos).toBe(1000);
  });
});

describe('calcularReserva', () => {
  const tarifas = { pricePerHour: HORA, pricePerDay: DIA, driverPrice: 2000, deposit: 30000 };

  it('suma el chofer por día empezado', () => {
    const r = calcularReserva(tarifas, horas(30), { conChofer: true });
    expect(r.diasCobrados).toBe(2);
    expect(r.driverFee).toBe(2 * 2000);
    expect(r.totalAmount).toBe(r.baseAmount + r.driverFee);
  });

  it('sin chofer no cobra chofer aunque el vehículo lo ofrezca', () => {
    expect(calcularReserva(tarifas, horas(24)).driverFee).toBe(0);
  });

  it('hoy no hay comisión: el total es el subtotal', () => {
    const r = calcularReserva(tarifas, horas(48));
    expect(r.serviceFee).toBe(0);
    expect(r.totalAmount).toBe(r.baseAmount);
  });

  it('la comisión se calcula en partes por mil y en enteros', () => {
    const r = calcularReserva(tarifas, horas(24), { comisionPorMil: 25 });
    expect(r.serviceFee).toBe(Math.round(DIA * 0.025));
    expect(Number.isInteger(r.serviceFee)).toBe(true);
    expect(r.totalAmount).toBe(r.baseAmount + r.serviceFee);
  });

  it('el depósito pasa tal cual y no entra en el total', () => {
    const r = calcularReserva(tarifas, horas(24));
    expect(r.deposit).toBe(30000);
    expect(r.totalAmount).not.toContain;
    expect(r.totalAmount).toBe(DIA);
  });

  it('todos los importes son enteros', () => {
    const r = calcularReserva(tarifas, horas(37), { conChofer: true, comisionPorMil: 137 });
    for (const v of [r.baseAmount, r.driverFee, r.serviceFee, r.totalAmount, r.deposit]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('conversión en los bordes', () => {
  it('convierte importes escritos por personas', () => {
    expect(aCentavos('120')).toBe(12000);
    expect(aCentavos('120.50')).toBe(12050);
    expect(aCentavos('120,50')).toBe(12050); // coma decimal, como se escribe aquí
    expect(aCentavos(0)).toBe(0);
  });

  it('no se deja engañar por la coma flotante', () => {
    expect(aCentavos(1.005)).toBe(101);
    expect(aCentavos(19.99)).toBe(1999);
    expect(aCentavos(0.07)).toBe(7);
  });

  it('rechaza lo que no es un importe', () => {
    for (const v of ['', null, undefined, 'gratis', -5, NaN, Infinity]) {
      expect(aCentavos(v)).toBeNull();
    }
  });

  it('ida y vuelta', () => {
    expect(aUnidades(aCentavos('89.99')!)).toBe(89.99);
  });
});
