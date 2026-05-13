import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function uploadToStorage(key: string, file: Express.Multer.File): Promise<string> {
  const filename = `${key}-${Date.now()}${path.extname(file.originalname || '.jpg')}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, file.buffer);
  return `/uploads/${filename}`;
}
