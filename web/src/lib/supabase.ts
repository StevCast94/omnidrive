import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Hay un proyecto Supabase por pais (Auth va separado, igual que la BD).
// Por eso estas claves no pueden estar escritas en el codigo: cada despliegue
// inyecta las suyas. La anon key es publica por diseno; el aislamiento real
// lo da que cada pais tenga su propio proyecto.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[OmniDrive] Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno de build.'
  );
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export function onAuthStateChange(cb: (token: string | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.access_token ?? null);
  });
}
