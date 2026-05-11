import { createClient } from '@supabase/supabase-js';

// Public (anon) key — safe to expose in frontend
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

/**
 * Returns the current session's access token, or null if not signed in.
 * Used by the Axios interceptor to attach Bearer tokens.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Listen to auth state changes globally.
 * Call once in main.tsx or App.tsx.
 */
export function onAuthStateChange(cb: (token: string | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.access_token ?? null);
  });
}
