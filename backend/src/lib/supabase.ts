import { createClient } from '@supabase/supabase-js';

// Admin client — service role key, solo en backend
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
