import { createClient } from '@supabase/supabase-js';

// Public (anon) key — safe to expose in frontend
export const supabase = createClient(
  "https://rkwbixidpaqweavghfea.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjYxOTgsImV4cCI6MjA5MzM0MjE5OH0.JnpkukDVuPIvtlBZyHrPFzBReDIVEITrD0uAqGix77U",
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

