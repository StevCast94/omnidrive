// ===== config/legal.ts =====
// Textos legales por país, versionados.
//
// La versión importa: cuando cambian los términos, la aceptación anterior deja
// de valer y hay que volver a pedirla. Una aceptación sin versión no dice a
// qué se dijo que sí.
//
// Estos textos son el marco mínimo para operar; antes de abrir a público
// general tienen que pasar por un abogado en cada país.

import { CountryCode, getCountry } from './country';

export type TipoDocumentoLegal = 'terminos' | 'privacidad' | 'cancelacion';

export interface DocumentoLegal {
  tipo: TipoDocumentoLegal;
  titulo: string;
  version: string;
  actualizado: string;
  /** Markdown ligero: párrafos separados por línea en blanco, ## para títulos. */
  contenido: string;
}

/**
 * Política de cancelación, en datos y no en prosa, para que el código pueda
 * aplicarla y el texto no pueda contradecir lo que hace el sistema.
 */
export interface PoliticaCancelacion {
  version: string;
  /** Horas antes del inicio a partir de las cuales se devuelve todo. */
  horasDevolucionTotal: number;
  /** Horas antes del inicio con devolución parcial. */
  horasDevolucionParcial: number;
  /** Porcentaje que se retiene en la ventana parcial (0-100). */
  penalizacionParcial: number;
  /** Porcentaje que se retiene al cancelar con menos margen. */
  penalizacionTardia: number;
}

export const POLITICA_CANCELACION: PoliticaCancelacion = {
  version: '2026-09-1',
  horasDevolucionTotal: 48,
  horasDevolucionParcial: 24,
  penalizacionParcial: 50,
  penalizacionTardia: 100,
};

/**
 * Qué se devuelve al cancelar, en partes por cien del importe del alquiler.
 * El depósito de garantía se devuelve SIEMPRE entero: no es del anfitrión.
 */
export function calcularDevolucion(
  horasHastaElInicio: number,
  cancelaElAnfitrion: boolean
): { porcentajeDevuelto: number; motivo: string } {
  // Si cancela el anfitrión, el inquilino no pierde nada: no fue su decisión.
  if (cancelaElAnfitrion) {
    return { porcentajeDevuelto: 100, motivo: 'Cancelada por el anfitrión' };
  }

  const p = POLITICA_CANCELACION;
  if (horasHastaElInicio >= p.horasDevolucionTotal) {
    return { porcentajeDevuelto: 100, motivo: `Cancelada con más de ${p.horasDevolucionTotal} h de antelación` };
  }
  if (horasHastaElInicio >= p.horasDevolucionParcial) {
    return {
      porcentajeDevuelto: 100 - p.penalizacionParcial,
      motivo: `Cancelada entre ${p.horasDevolucionParcial} y ${p.horasDevolucionTotal} h antes`,
    };
  }
  return {
    porcentajeDevuelto: 100 - p.penalizacionTardia,
    motivo: `Cancelada con menos de ${p.horasDevolucionParcial} h de antelación`,
  };
}

// ── Textos ────────────────────────────────────────────────────────────

const VERSION = '2026-09-1';

export function documentosLegales(codigo: CountryCode): DocumentoLegal[] {
  const pais = getCountry(codigo);
  const p = POLITICA_CANCELACION;

  return [
    {
      tipo: 'terminos',
      titulo: 'Términos y condiciones',
      version: VERSION,
      actualizado: '2026-09-12',
      contenido: `
## Qué es OmniDrive

OmniDrive es un espacio donde personas de ${pais.name} ponen su vehículo a disposición de otras. **No somos una empresa de alquiler de vehículos**: no somos dueños de ningún vehículo ni prestamos el servicio de transporte. Conectamos a quien tiene un vehículo con quien lo necesita, verificamos identidades y custodiamos el dinero mientras dura el alquiler.

## Quién puede usarlo

Debes ser mayor de edad, tener licencia de conducir vigente y pasar nuestra verificación de identidad. Publicar un vehículo exige además ser su propietario o estar autorizado por escrito para alquilarlo.

## El vehículo y su estado

El anfitrión responde de que el vehículo esté en condiciones de circular, con su documentación al día. El arrendatario responde del vehículo mientras lo tiene: multas, combustible, peajes y cualquier daño ocurrido durante el alquiler.

**Las fotos antes y después son la prueba del estado del vehículo.** Recomendamos encarecidamente tomarlas: en una disputa, es lo primero que miramos.

## Seguro

OmniDrive **no proporciona seguro**. El vehículo debe contar con el seguro obligatorio que exige la ley de ${pais.name}, y cualquier cobertura adicional es acuerdo entre las partes. Al reservar, ambas partes aceptan que el riesgo del alquiler es suyo.

## El dinero

El importe del alquiler y el depósito de garantía se retienen en tu billetera al confirmar la reserva. Al finalizar, el anfitrión cobra el alquiler y el depósito vuelve al arrendatario. Si hay daños, el depósito puede retenerse total o parcialmente tras revisar las pruebas de ambas partes.

Los precios se publican en ${pais.currency}. El ${pais.taxName} aplicable es del ${pais.taxRate}%.

## Conducta

Está prohibido subarrendar el vehículo, usarlo para actividades ilegales, sacarlo del país sin autorización escrita del anfitrión o conducirlo alguien distinto de quien reservó, salvo acuerdo expreso.

Podemos suspender una cuenta que incumpla estas reglas, y vetar un documento de identidad que las incumpla de forma grave.

## Cambios

Si cambiamos estos términos, te pediremos que los aceptes de nuevo antes de tu siguiente reserva.
`.trim(),
    },

    {
      tipo: 'privacidad',
      titulo: 'Política de privacidad',
      version: VERSION,
      actualizado: '2026-09-12',
      contenido: `
## Qué datos tratamos y para qué

Tratamos tus datos conforme a la ${pais.dataProtectionLaw} de ${pais.name}.

- **Identidad** (nombre, documento, selfie, licencia): para verificar que eres quien dices ser. Sin esto no hay confianza posible entre desconocidos que se prestan un vehículo.
- **Contacto** (email, teléfono): para avisarte de tus reservas.
- **Reservas y pagos**: para prestar el servicio y cumplir obligaciones contables.
- **Ubicación durante el alquiler**: sólo si la activas, sólo mientras la reserva está en curso, y visible únicamente para ti y el anfitrión del vehículo. Ver el apartado siguiente.

## Ubicación

El rastreo **nunca se activa solo**. Requiere tu consentimiento explícito al iniciar el alquiler, se apaga automáticamente al finalizarlo, y los puntos se borran a los 90 días.

Sólo pueden verlo el anfitrión de ese vehículo y tú. Nuestro personal no accede a tu recorrido salvo que haya una disputa abierta sobre esa reserva, y cada acceso queda registrado.

## Con quién los compartimos

Con el anfitrión o arrendatario de tu reserva, lo justo para que el alquiler funcione: nombre, foto, valoración y teléfono una vez confirmada. Con proveedores que nos prestan servicio (almacenamiento de imágenes, verificación de identidad, correo). Con las autoridades cuando la ley lo exija.

**No vendemos tus datos ni los cedemos para publicidad de terceros.**

## Cuánto tiempo

Mientras tengas cuenta, y después el tiempo que exijan las obligaciones legales y contables. Los puntos de ubicación, 90 días.

## Tus derechos

Puedes pedirnos acceso, rectificación, eliminación, oposición y portabilidad de tus datos escribiendo desde el correo de tu cuenta. Te responderemos en los plazos que marca la ${pais.dataProtectionLaw}.

Eliminar tu cuenta no borra las reservas ya completadas: son necesarias para la contabilidad y para las valoraciones de la otra parte.
`.trim(),
    },

    {
      tipo: 'cancelacion',
      titulo: 'Política de cancelación',
      version: p.version,
      actualizado: '2026-09-12',
      contenido: `
## Si cancelas tú

- **Con ${p.horasDevolucionTotal} horas o más** antes de la hora de entrega: se te devuelve el **100%**.
- **Entre ${p.horasDevolucionParcial} y ${p.horasDevolucionTotal} horas** antes: se te devuelve el **${100 - p.penalizacionParcial}%** del alquiler.
- **Con menos de ${p.horasDevolucionParcial} horas**: no se devuelve el importe del alquiler.

**El depósito de garantía se devuelve íntegro en todos los casos.** No es del anfitrión: es una garantía, y si no hubo alquiler no hay nada que garantizar.

## Si cancela el anfitrión

Se te devuelve **todo**, incluido el depósito, sin importar cuándo. Cancelar no debería salirte caro por una decisión que no tomaste.

Cancelar reservas confirmadas de forma reiterada afecta a la reputación del anfitrión y puede suponer la suspensión de su cuenta.

## Si el vehículo no está como se describió

Avísanos antes de iniciar el alquiler, con fotos. Si lo confirmamos, se cancela sin penalización y se te devuelve todo.
`.trim(),
    },
  ];
}

/** La versión vigente de cada documento, para saber si una aceptación caducó. */
export function versionesVigentes(codigo: CountryCode): Record<TipoDocumentoLegal, string> {
  const docs = documentosLegales(codigo);
  return Object.fromEntries(docs.map(d => [d.tipo, d.version])) as Record<TipoDocumentoLegal, string>;
}
