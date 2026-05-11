import { supabaseAdmin } from './supabase';

const BUCKET = process.env.SUPABASE_BUCKET || 'omnidrive';

export async function uploadToStorage(path: string, file: Express.Multer.File): Promise<string> {
  const ext = file.originalname.split('.').pop() || 'jpg';
  const fullPath = `${path}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(fullPath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fullPath);
  return data.publicUrl;
}
