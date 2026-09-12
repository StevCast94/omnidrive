import { describe, it, expect } from 'vitest';
import { calcularDevolucion, documentosLegales, versionesVigentes, POLITICA_CANCELACION } from './legal';

describe('política de cancelación', () => {
  it('con mucha antelación se devuelve todo', () => {
    expect(calcularDevolucion(72, false).porcentajeDevuelto).toBe(100);
    expect(calcularDevolucion(48, false).porcentajeDevuelto).toBe(100);
  });

  it('en la ventana intermedia se devuelve la mitad', () => {
    expect(calcularDevolucion(47, false).porcentajeDevuelto).toBe(50);
    expect(calcularDevolucion(24, false).porcentajeDevuelto).toBe(50);
  });

  it('a última hora no se devuelve el alquiler', () => {
    expect(calcularDevolucion(23, false).porcentajeDevuelto).toBe(0);
    expect(calcularDevolucion(0, false).porcentajeDevuelto).toBe(0);
  });

  it('si cancela el anfitrión, el inquilino no pierde nada', () => {
    // Da igual el margen: no fue su decisión.
    for (const horas of [72, 47, 23, 1, 0]) {
      expect(calcularDevolucion(horas, true).porcentajeDevuelto).toBe(100);
    }
  });

  it('una reserva ya empezada cuenta como cancelación tardía', () => {
    expect(calcularDevolucion(-5, false).porcentajeDevuelto).toBe(0);
  });
});

describe('textos legales', () => {
  it('cada país tiene sus tres documentos con su ley de datos', () => {
    for (const pais of ['EC', 'DO'] as const) {
      const docs = documentosLegales(pais);
      expect(docs.map(d => d.tipo).sort()).toEqual(['cancelacion', 'privacidad', 'terminos']);
      expect(docs.every(d => d.contenido.length > 500)).toBe(true);
    }
  });

  it('la política de privacidad nombra la ley del país', () => {
    const ec = documentosLegales('EC').find(d => d.tipo === 'privacidad')!;
    const rd = documentosLegales('DO').find(d => d.tipo === 'privacidad')!;
    expect(ec.contenido).toContain('LOPDP');
    expect(rd.contenido).toContain('172-13');
  });

  it('los términos usan la moneda y el impuesto del país', () => {
    expect(documentosLegales('EC').find(d => d.tipo === 'terminos')!.contenido).toContain('IVA');
    expect(documentosLegales('DO').find(d => d.tipo === 'terminos')!.contenido).toContain('ITBIS');
  });

  it('el texto de cancelación dice los mismos plazos que aplica el código', () => {
    const texto = documentosLegales('EC').find(d => d.tipo === 'cancelacion')!.contenido;
    expect(texto).toContain(`${POLITICA_CANCELACION.horasDevolucionTotal} horas`);
    expect(texto).toContain(`${POLITICA_CANCELACION.horasDevolucionParcial} horas`);
  });

  it('todos los documentos tienen versión', () => {
    const v = versionesVigentes('EC');
    expect(Object.values(v).every(x => /^\d{4}-\d{2}-\d$/.test(x))).toBe(true);
  });
});
