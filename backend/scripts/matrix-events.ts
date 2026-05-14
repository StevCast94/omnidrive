const supabaseUrl = "https://rkwbixidpaqweavghfea.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc2NjE5OCwiZXhwIjoyMDkzMzQyMTk4fQ.YhuyGwW8qia858aqMfu3nhPkmLNoIRgdWpQ6AxSvI9U";

// Usamos UUIDs fijos para el agente Timmy y proyecto OmniDrive
const AGENT_ID = "00000000-0000-0000-0000-000000000001";
const PROJECT_ID = "00000000-0000-0000-0000-00000000f001";

const TASK_PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

const events = [
  {
    type: "feature_request",
    severity: "low",
    title: "[OmniDrive] Métodos de pago alternativos",
    body: `Propuesta de Stevens para mejorar experiencia de pago:

1. **Transferencia directa**: Opción de pago por transferencia bancaria a cuenta del arrendatario. Solo disponible para usuarios con suscripción activa.
2. **Pago con Wallet**: Pago usando saldo en wallet de la app. Aplica descuento especial por usar el ecosistema interno.
3. **Pago en efectivo P2P**: Pago en efectivo con validación cruzada (arrendador + arrendatario confirman). Requiere aprobación de ambas partes.

Estado: Idea registrada, pendiente de madurar y calendarizar.`,
    agent_id: AGENT_ID,
    project_id: PROJECT_ID,
    task_id: TASK_PLACEHOLDER
  },
  {
    type: "feature_request",
    severity: "low",
    title: "[OmniDrive] Contrato digital con firma para alquiler de vehículos",
    body: `Propuesta de Stevens para complementar la normativa del negocio:

Modelo de contrato digital que cubra:
- **Términos de alquiler**: fechas, tarifas, depósito, km incluidos
- **Límites de uso**: kilometraje máximo, áreas geográficas permitidas, prohibiciones
- **Condiciones del vehículo**: estado de entrega, fotos before/after, nivel de combustible
- **Sanciones**: multas por devolución tardía, daños, exceso de km, multas de tránsito
- **Firma digital**: ambas partes firman electrónicamente al confirmar la reserva
- **Jurisdicción**: leyes aplicables, resolución de disputas

Esta feature es la BASE normativa del negocio. Todo lo demás (métodos de pago, seguros, disputas) se complementa sobre esto.

Estado: Idea registrada, pendiente de diseñar el modelo legal y técnico.`,
    agent_id: AGENT_ID,
    project_id: PROJECT_ID,
    task_id: TASK_PLACEHOLDER
  }
];

async function main() {
  for (const ev of events) {
    const res = await fetch(`${supabaseUrl}/rest/v1/events`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(ev)
    });
    const text = await res.text();
    console.log(ev.title.slice(0, 40), "→", res.status, text.slice(0, 100));
  }
}
main().catch(console.error);
