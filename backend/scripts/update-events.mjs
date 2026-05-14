const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc2NjE5OCwiZXhwIjoyMDkzMzQyMTk4fQ.YhuyGwW8qia858aqMfu3nhPkmLNoIRgdWpQ6AxSvI9U";
const BASE = "https://rkwbixidpaqweavghfea.supabase.co";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };

async function main() {
  // 1. Wallet como sistema de confianza
  const r1 = await fetch(`${BASE}/rest/v1/events?id=eq.a47fe107-3fbd-4c48-b28d-395a7d479283`, {
    method: "PATCH", headers: H,
    body: JSON.stringify({
      body: `PROPUESTA COMPLETA - Wallet como seguro P2P (Stevens, 14-may-2026)

Mecanismo:
1. El deposito se aparta (hold) en la wallet - no se descuenta, se congela
2. El usuario ve su saldo total, pero parte aparece como retenido por reservas activas
3. Durante la renta el deposito esta congelado - no se puede retirar ni usar
4. Al completar sin novedades: arrendatario inspecciona, acepta conformidad (firma digital) -> hold se libera automaticamente
5. Si hay reclamo: arrendatario NO firma conformidad -> deposito retenido -> se abre disputa -> hold se mantiene hasta resolucion

Las 3 aceptaciones clave:
A) AGENDAMIENTO: aceptar terminos generales, politica de cancelacion, sanciones
B) ENTREGA: aceptar estado del vehiculo (fotos, combustible, km), condiciones especificas
C) REENTREGA: aceptar que todo esta en orden -> LIBERA EL DEPOSITO

Los reclamos solo proceden entre B y C (antes de firmar conformidad). Despues de C no hay reclamo, el deposito se libera automaticamente.

Ventajas: psicologicamente el usuario no siente que perdio dinero, legalmente el deposito esta garantizado sin mover dinero real, tecnicamente ya existe wallet + holds + disputas - es conectar piezas existentes.

Backlog: Pendiente de priorizar vs Stripe y flujo base.`
    })
  });
  console.log("Wallet update:", r1.status);

  // 2. Contrato digital
  const r2 = await fetch(`${BASE}/rest/v1/events?id=eq.91d125d7-bb7f-43d8-8d63-bb0210aaf579`, {
    method: "PATCH", headers: H,
    body: JSON.stringify({
      body: `PROPUESTA COMPLETA - Contrato digital con firma (Stevens, 14-may-2026)

Modelo de contrato digital que cubra:
- Terminos de alquiler: fechas, tarifas, deposito, km incluidos
- Limites de uso: km maximo, areas geograficas permitidas, prohibiciones
- Condiciones del vehiculo: estado de entrega, fotos before/after, nivel de combustible
- Sanciones: multas por devolucion tardia, danos, exceso de km, multas de transito
- Firma digital: ambas partes firman electronicamente al confirmar la reserva
- Jurisdiccion: leyes aplicables, resolucion de disputas

Esta feature es la BASE normativa del negocio. Todo lo demas (metodos de pago, seguros, disputas) se complementa sobre esto.

Las clausulas de aceptacion deben ser muy especificas en: agendamiento, entrega y reentrega del vehiculo. La aceptacion completa se da luego de confirmar que todo esta en orden.

Backlog: Pendiente de disenar modelo legal y tecnico.`
    })
  });
  console.log("Contract update:", r2.status);

  // 3. Metodos de pago
  const r3 = await fetch(`${BASE}/rest/v1/events?id=eq.8cac307e-e9f7-4be8-8694-263b0b04cbef`, {
    method: "PATCH", headers: H,
    body: JSON.stringify({
      body: `PROPUESTA COMPLETA - Metodos de pago alternativos (Stevens, 14-may-2026)

1. TRANSFERENCIA DIRECTA: Pago por transferencia bancaria a cuenta del arrendatario. Solo disponible para usuarios con suscripcion activa.
2. PAGO CON WALLET: Pago usando saldo en wallet de la app. Aplica descuento especial por usar el ecosistema interno.
3. PAGO EN EFECTIVO P2P: Pago en efectivo con validacion cruzada (arrendador + arrendatario confirman cada uno). Requiere aprobacion de ambas partes.

Estos metodos complementan al pago con Stripe (tarjeta). La wallet como seguro P2P se detalla en evento separado.

Backlog: Pendiente de priorizar vs flujo base de reserva y Stripe.`
    })
  });
  console.log("Payment update:", r3.status);
}
main().catch(e => console.error(e.message));
