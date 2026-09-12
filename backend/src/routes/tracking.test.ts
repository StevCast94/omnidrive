import { describe, it, expect } from 'vitest';

// El rastreo de ubicación tiene una regla que no depende de ninguna base de
// datos y conviene dejar fijada: iniciar un alquiler NO puede activar el
// rastreo. Hubo una versión que lo hacía, y el anfitrión encendía la ubicación
// del inquilino sin que este dijera nada.
import { readFileSync } from 'fs';
import { join } from 'path';

describe('rastreo: consentimiento', () => {
  const bookings = readFileSync(join(__dirname, 'bookings.ts'), 'utf8');

  it('REGRESIÓN: iniciar el alquiler no activa el rastreo', () => {
    // Se busca el handler de /start y se comprueba que no enciende nada.
    const inicio = bookings.indexOf("'/:id/start'");
    const fin = bookings.indexOf("'/:id/end'");
    const handlerStart = bookings.slice(inicio, fin);

    expect(handlerStart).not.toContain('trackingEnabled: true');
  });

  it('finalizar el alquiler sí lo apaga', () => {
    const fin = bookings.indexOf("'/:id/end'");
    expect(bookings.slice(fin)).toContain('trackingEnabled: false');
  });
});
