import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) { console.log('ERROR:', error.message); process.exit(1); }
  const list = data.users.map(u => ({ email: u.email, created: u.created_at }));
  console.log(JSON.stringify(list, null, 2));
  process.exit(0);
}
main().catch(e => { console.log('CATCH:', e.message); process.exit(1); });
