// ===== services/mailer.ts =====
// Envio de correo transaccional. Usa Resend si hay clave; si no, deja el
// contenido en el log y lo dice claramente.
//
// El modo sin clave NO es un fallback silencioso: un correo que se pierde sin
// avisar es como los backups vacios que este proyecto arrastro meses. Si falta
// la clave, la peticion sigue adelante pero el log grita.

import { env } from '../config/env';
import { getCountry } from '../config/country';

interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

export async function enviarCorreo(correo: Correo): Promise<{ enviado: boolean; motivo?: string }> {
  if (!env.RESEND_API_KEY) {
    console.warn(
      `[Mailer] SIN RESEND_API_KEY — correo NO enviado a ${correo.para}: "${correo.asunto}"\n` +
      `[Mailer] Contenido:\n${correo.texto}`
    );
    return { enviado: false, motivo: 'RESEND_API_KEY no configurada' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: correo.para,
      subject: correo.asunto,
      html: correo.html,
      text: correo.texto,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text();
    console.error(`[Mailer] Fallo al enviar a ${correo.para}: ${res.status} ${detalle}`);
    return { enviado: false, motivo: `Resend respondio ${res.status}` };
  }
  return { enviado: true };
}

export async function enviarResetPassword(para: string, token: string) {
  const pais = getCountry(env.COUNTRY_CODE);
  // El sitio sale de la configuracion del pais, no de FRONTEND_URL, que
  // apuntaba a un dominio de Railway que ya nadie usa. Y sin '#': las rutas
  // dejaron de ser por hash.
  const enlace = `${pais.siteUrl.replace(/[/]+$/, '')}/reset-password?token=${token}`;

  return enviarCorreo({
    para,
    asunto: 'Restablece tu contraseña de OmniDrive',
    texto:
      `Recibimos una solicitud para restablecer tu contraseña de OmniDrive ${pais.name}.\n\n` +
      `Abre este enlace: ${enlace}\n\n` +
      `El enlace caduca en 1 hora y solo sirve una vez.\n` +
      `Si no fuiste tú, ignora este correo: tu contraseña no cambia.`,
    html:
      `<p>Recibimos una solicitud para restablecer tu contraseña de OmniDrive ${pais.name}.</p>` +
      `<p><a href="${enlace}">Restablecer mi contraseña</a></p>` +
      `<p>El enlace caduca en 1 hora y solo sirve una vez.</p>` +
      `<p>Si no fuiste tú, ignora este correo: tu contraseña no cambia.</p>`,
  });
}
