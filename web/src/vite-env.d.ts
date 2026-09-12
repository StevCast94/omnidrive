/// <reference types="vite/client" />

// Variables de build. Cada pais inyecta las suyas: las claves no viven en el
// codigo, porque hay un despliegue por pais.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_COUNTRY_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
