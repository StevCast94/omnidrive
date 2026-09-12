// ===== components/GoogleButton.tsx =====
// Boton de Google con Google Identity Services.
//
// El flujo anterior era un redirect de OAuth a traves de Supabase, que dejaba
// el token en el hash de la URL y obligaba a una pagina de callback y a
// adivinar donde ponia Supabase el '#'. Con GIS el navegador entrega un
// id_token aqui mismo y el backend lo verifica contra las claves de Google:
// sin redirect, sin pagina de callback y sin intermediario.

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: any;
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SRC = 'https://accounts.google.com/gsi/client';

let cargando: Promise<void> | null = null;

function cargarScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (cargando) return cargando;

  cargando = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('No se pudo cargar Google'));
    document.head.appendChild(el);
  });
  return cargando;
}

interface Props {
  onToken: (idToken: string) => void;
  texto?: 'signin_with' | 'signup_with' | 'continue_with';
  disabled?: boolean;
}

export default function GoogleButton({ onToken, texto = 'continue_with', disabled }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  // El callback vive en una ref: GIS se inicializa una sola vez y no debe
  // quedarse con una version vieja de la funcion.
  const alRecibirToken = useRef(onToken);
  alRecibirToken.current = onToken;

  useEffect(() => {
    if (!CLIENT_ID || !contenedor.current) return;
    let cancelado = false;

    cargarScript()
      .then(() => {
        if (cancelado || !contenedor.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (respuesta: { credential?: string }) => {
            if (respuesta.credential) alRecibirToken.current(respuesta.credential);
          },
        });
        window.google.accounts.id.renderButton(contenedor.current, {
          theme: 'outline',
          size: 'large',
          width: contenedor.current.offsetWidth || 320,
          text: texto,
          locale: 'es',
        });
      })
      .catch(() => !cancelado && setError(true));

    return () => { cancelado = true; };
  }, [texto]);

  // Sin cliente configurado no hay boton roto: simplemente no aparece, y
  // queda el acceso con email y contraseña.
  if (!CLIENT_ID) return null;

  if (error) {
    return (
      <p className="text-center text-sm text-slate-400">
        No se pudo cargar el acceso con Google. Entra con tu email y contraseña.
      </p>
    );
  }

  return <div ref={contenedor} className={disabled ? 'pointer-events-none opacity-60' : ''} />;
}
