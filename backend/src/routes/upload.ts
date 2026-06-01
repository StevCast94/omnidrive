import { Router, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const uploadRouter = Router();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: 'omnidrive',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  }),
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/upload
uploadRouter.post('/', authenticate, upload.single('file'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as any;
  if (!file) {
    return res.status(400).json({ data: null, error: 'No file uploaded' });
  }
  return res.json({
    data: { url: file.path, publicId: file.filename },
    error: null,
  });
}));
