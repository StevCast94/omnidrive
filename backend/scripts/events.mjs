const SUPABASE_URL = "https://rkwbixidpaqweavghfea.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc2NjE5OCwiZXhwIjoyMDkzMzQyMTk4fQ.YhuyGwW8qia858aqMfu3nhPkmLNoIRgdWpQ6AxSvI9U";
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };

const PROJECT_ID = "fb69c8e8-56ad-4d54-88e0-3a570851d9b9";
const AGENT_ID = "58eed2f0-1846-45f3-92b8-e5a5c307f25e";

async function main() {
  // 1. Create task
  const taskRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      project_id: PROJECT_ID,
      title: "OmniDrive — Métodos de pago y contrato digital",
      description: "Features propuestas por Stevens: métodos de pago alternativos y contrato digital con firma.",
      status: "pending",
      created_by: "stevens"
    })
  });
  if (!taskRes.ok) {
    console.log("Task error:", taskRes.status, await taskRes.text());
    return;
  }
  // Get the new task
  const tasksRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?project_id=eq.${PROJECT_ID}&title=like.*Métodos*&order=created_at.desc&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const tasks = await tasksRes.json();
  const taskId = tasks[0]?.id;
  if (!taskId) { console.log("No task ID found"); return; }
  console.log("Task created:", taskId);

  // 2. Create events
  for (const ev of [
    { type:"info", severity:"info", title:"[OmniDrive] Métodos de pago alternativos",
      body:"1) Transferencia directa solo subscriptores 2) Pago Wallet con descuento 3) Pago efectivo P2P con doble validación.",
      agent_id:AGENT_ID, project_id:PROJECT_ID, task_id:taskId },
    { type:"info", severity:"info", title:"[OmniDrive] Contrato digital con firma",
      body:"Modelo de contrato digital para alquiler de vehículos con términos, límites, sanciones y firma electrónica. Base normativa del negocio.",
      agent_id:AGENT_ID, project_id:PROJECT_ID, task_id:taskId },
    { type:"info", severity:"info", title:"[OmniDrive] Wallet como sistema de confianza (depósito P2P)",
      body:"Propuesta de Stevens: La wallet funciona como seguro P2P. El depósito se aparta (hold) no se cobra — el usuario lo ve como saldo retenido, no como dinero perdido. Se libera al completar la renta sin novedades. El arrendatario revisa, acepta conformidad y el hold se libera. Si hay reclamo, no se firma la conformidad y la disputa retiene el depósito. 3 aceptaciones clave: 1) Agendamiento (términos generales) 2) Entrega (estado del vehículo) 3) Reentrega (libera depósito). Los reclamos solo proceden entre 2 y 3. El sistema de holds + disputas ya existe en el backend, es conectar piezas.",
      agent_id:AGENT_ID, project_id:PROJECT_ID, task_id:taskId }
  ]) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: "POST", headers: HEADERS, body: JSON.stringify(ev)
    });
    console.log(ev.title.slice(0, 40), "→", r.status);
    if (!r.ok) console.log("  ", await r.text());
  }
}
main().catch(console.error);
