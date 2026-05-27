import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

const uploadDir = path.resolve(env.upload.dir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Định dạng file không hợp lệ. Chỉ cho phép tải lên file PDF, JPG, JPEG, PNG.'));
    }
  },
});
