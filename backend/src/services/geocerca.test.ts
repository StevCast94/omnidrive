import { describe, it, expect } from 'vitest';
import { distanciaKm, estaFuera } from './geocerca';

// Puntos reales de los dos mercados piloto.
const SALINAS = { lat: -2.2145, lng: -80.9584 };
const MONTANITA = { lat: -1.8266, lng: -80.7545 };
const GUAYAQUIL = { lat: -2.1709, lng: -79.9224 };
const PUNTA_CANA = { lat: 18.5820, lng: -68.4055 };

describe('distancia', () => {
  it('de Salinas a Montañita hay unos 49 km', () => {
    expect(distanciaKm(SALINAS.lat, SALINAS.lng, MONTANITA.lat, MONTANITA.lng)).toBeCloseTo(48.7, 1);
  });

  it('de Salinas a Guayaquil hay unos 115 km', () => {
    expect(distanciaKm(SALINAS.lat, SALINAS.lng, GUAYAQUIL.lat, GUAYAQUIL.lng)).toBeCloseTo(115, 0);
  });

  it('el mismo punto está a cero', () => {
    expect(distanciaKm(SALINAS.lat, SALINAS.lng, SALINAS.lat, SALINAS.lng)).toBe(0);
  });

  it('es simétrica', () => {
    const ida = distanciaKm(SALINAS.lat, SALINAS.lng, PUNTA_CANA.lat, PUNTA_CANA.lng);
    const vuelta = distanciaKm(PUNTA_CANA.lat, PUNTA_CANA.lng, SALINAS.lat, SALINAS.lng);
    expect(ida).toBeCloseTo(vuelta, 6);
  });

  it('cruza el meridiano sin dar la vuelta al mundo', () => {
    // Un cálculo ingenuo restando longitudes daría casi 40.000 km aquí.
    expect(distanciaKm(0, -0.5, 0, 0.5)).toBeCloseTo(111, 0);
  });
});

describe('geocerca', () => {
  const zona = { ...SALINAS, radioKm: 60 };

  it('dentro del radio no avisa', () => {
    expect(estaFuera(SALINAS, zona)).toBe(false);
    expect(estaFuera(MONTANITA, zona)).toBe(false); // 48,7 km, dentro de 60
  });

  it('fuera del radio sí avisa', () => {
    expect(estaFuera(GUAYAQUIL, zona)).toBe(true);  // 115 km
    expect(estaFuera(PUNTA_CANA, zona)).toBe(true); // otro país
  });

  it('justo en el borde cuenta como dentro', () => {
    // Quien define 60 km espera poder llegar a 60 km sin que suene la alarma.
    const aExactamente60 = { lat: SALINAS.lat + 60 / 111.32, lng: SALINAS.lng };
    expect(estaFuera(aExactamente60, { ...SALINAS, radioKm: 60.1 })).toBe(false);
  });
});
