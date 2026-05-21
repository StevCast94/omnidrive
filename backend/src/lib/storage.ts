/**
 * Storage utility — delega a Cloudinary.
 * Los uploads se manejan desde routes/upload.ts con multer-storage-cloudinary.
 * Este módulo queda como wrapper para uso programático.
 */
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function uploadToStorage(key: string, file: Express.Multer.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'omnidrive',
        public_id: key,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) return reject(error)
        if (!result) return reject(new Error('Cloudinary upload returned no result'))
        resolve(result.secure_url)
      }
    )
    uploadStream.end(file.buffer)
  })
}

export async function deleteFromStorage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}
