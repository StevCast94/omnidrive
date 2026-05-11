// ===== src/lib/prisma.ts =====
import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient({ log: ['error'] });
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;


// ===== src/lib/storage.ts =====
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const BUCKET = process.env.SUPABASE_BUCKET ?? 'omnidrive';

export async function uploadToStorage(path: string, file: Express.Multer.File): Promise<string> {
  const ext = file.originalname.split('.').pop() ?? 'jpg';
  const fullPath = `${path}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
  return data.publicUrl;
}
