import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rkwbixidpaqweavghfea.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjYxOTgsImV4cCI6MjA5MzM0MjE5OH0.JnpkukDVuPIvtlBZyHrPFzBReDIVEITrD0uAqGix77U';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('[OmniDrive] Supabase URL and ANON KEY are required.');
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
