// Quick script: create storage bucket via Supabase client API
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://rkwbixidpaqweavghfea.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrd2JpeGlkcGFxd2VhdmdoZmVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc2NjE5OCwiZXhwIjoyMDkzMzQyMTk4fQ.YhuyGwW8qia858aqMfu3nhPkmLNoIRgdWpQ6AxSvI9U'
);

async function main() {
  // List buckets
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.find(b => b.name === 'omnidrive');

  if (exists) {
    console.log('✓ Bucket "omnidrive" already exists');
  } else {
    const { data, error } = await supabase.storage.createBucket('omnidrive', {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (error) { console.error('❌', error.message); return; }
    console.log('✓ Bucket "omnidrive" created');
  }
  console.log('✅ Done');
}

main().catch(e => console.error(e.message));
