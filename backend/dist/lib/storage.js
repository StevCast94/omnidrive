"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToStorage = uploadToStorage;
exports.deleteFromStorage = deleteFromStorage;
/**
 * Storage utility — delega a Cloudinary.
 * Los uploads se manejan desde routes/upload.ts con multer-storage-cloudinary.
 * Este módulo queda como wrapper para uso programático.
 */
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
async function uploadToStorage(key, file) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder: 'omnidrive',
            public_id: key,
            resource_type: 'auto',
        }, (error, result) => {
            if (error)
                return reject(error);
            if (!result)
                return reject(new Error('Cloudinary upload returned no result'));
            resolve(result.secure_url);
        });
        uploadStream.end(file.buffer);
    });
}
async function deleteFromStorage(publicId) {
    await cloudinary_1.v2.uploader.destroy(publicId);
}
//# sourceMappingURL=storage.js.map