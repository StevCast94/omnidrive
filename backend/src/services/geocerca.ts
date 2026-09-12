// ===== services/geocerca.ts =====
// Aviso al dueño cuando el vehiculo sale de la zona acordada.

import { prisma } from '../lib/prisma';
import { sendPush } from './push';

export interface Geocerca {
  lat: number;
  lng: number;
  radioKm: number;
}

/**
 * Distancia entre dos puntos de la Tierra, en kilometros (Haversine).
 *
 * Un calculo plano se equivoca mas cuanto mas lejos del ecuador; aqui da igual
 * a escala de kilometros, pero no cuesta nada hacerlo bien.
 */
export function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

export function estaFuera(punto: { lat: number; lng: number }, cerca: Geocerca): boolean {
  return distanciaKm(punto.lat, punto.lng, cerca.lat, cerca.lng) > cerca.radioKm;
}

/**
 * Comprueba un punto contra la geocerca de la reserva y avisa al dueño si
 * salió. Sólo avisa UNA vez por salida: un vehículo aparcado justo en el borde
 * no debe disparar una notificación cada treinta segundos.
 */
export async function revisarGeocerca(
  bookingId: string,
  punto: { lat: number; lng: number }
): Promise<void> {
  const reserva = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, insuranceDetails: true,
      vehicle: { select: { ownerId: true, brand: true, model: true } },
    },
  });

  const detalles = reserva?.insuranceDetails as any;
  const cerca: Geocerca | null = detalles?.geocerca ?? null;
  if (!reserva || !cerca) return;

  const fuera = estaFuera(punto, cerca);
  const yaAvisado = Boolean(detalles.geocercaAvisadaEn);

  if (fuera && !yaAvisado) {
    const distancia = distanciaKm(punto.lat, punto.lng, cerca.lat, cerca.lng);

    await prisma.booking.update({
      where: { id: reserva.id },
      data: { insuranceDetails: { ...detalles, geocercaAvisadaEn: new Date().toISOString() } },
    });

    const aviso = {
      userId: reserva.vehicle.ownerId,
      type: 'geocerca_salida',
      title: 'Tu vehículo salió de la zona',
      body: `El ${reserva.vehicle.brand} ${reserva.vehicle.model} está a ${distancia.toFixed(1)} km del centro de la zona que definiste.`,
      data: { bookingId: reserva.id, lat: punto.lat, lng: punto.lng, distanciaKm: distancia },
    };

    await prisma.notification.create({ data: aviso });
    await sendPush(reserva.vehicle.ownerId, { title: aviso.title, body: aviso.body, data: aviso.data }).catch(() => {
      // Que falle el push no debe romper la recepción de puntos: la
      // notificación ya quedó guardada y se verá en la campana.
    });
  }

  // Al volver a entrar se rearma el aviso, para que una segunda salida vuelva
  // a notificar.
  if (!fuera && yaAvisado) {
    await prisma.booking.update({
      where: { id: reserva.id },
      data: { insuranceDetails: { ...detalles, geocercaAvisadaEn: null } },
    });
  }
}
