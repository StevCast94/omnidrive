import { Router, Request, Response } from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'

const router = Router()

// Configure Cloudinary from env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// --- Storage: fotos de vehículos (alta calidad) ---
const vehicleStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'omnidrive/vehicles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
  } as any,
})

const uploadVehicle = multer({
  storage: vehicleStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Formato no soportado. Usa: jpg, png, webg, gif, avif'))
  },
})

// --- Storage: documentos de identidad (compresión fuerte) ---
const docStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'omnidrive/documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  } as any,
})

const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Formato no soportado. Usa: jpg, png, webp, pdf'))
  },
})

// --- Rutas ---

// POST /api/upload/vehicle — Subir foto de vehículo
router.post('/vehicle', (req: Request, res: Response) => {
  uploadVehicle.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'La imagen no puede superar 10MB' })
      }
      return res.status(400).json({ error: err.message })
    }
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: 'No se envió ninguna imagen' })
    }

    // Optimización en URL: calidad automática + formato óptimo
    const urlParts = req.file.path.split('/upload/')
    const optimizedUrl = urlParts.length > 1
      ? urlParts[0] + '/upload/q_auto:best,f_auto/' + urlParts[1]
      : req.file.path

    res.json({
      url: optimizedUrl,
      public_id: (req.file as any).filename,
    })
  })
})

// POST /api/upload/document — Subir documento de identidad
router.post('/document', (req: Request, res: Response) => {
  uploadDoc.single('document')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'El documento no puede superar 5MB' })
      }
      return res.status(400).json({ error: err.message })
    }
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: 'No se envió ningún documento' })
    }

    // Documentos: compresión fuerte, dimensiones para lectura
    const urlParts = req.file.path.split('/upload/')
    const optimizedUrl = urlParts.length > 1
      ? urlParts[0] + '/upload/q_auto:low,f_webp,w_1200,c_limit/' + urlParts[1]
      : req.file.path

    res.json({
      url: optimizedUrl,
      public_id: (req.file as any).filename,
    })
  })
})

export const uploadRouter = router
