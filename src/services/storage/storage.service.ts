import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/errorHandler';

export type StorageBucket = 'avatars' | 'company-logos' | 'cvs' | 'chat-files';

type BucketConfig = {
  maxSize: number;
  allowedTypes: string[];
  allowedExts: string[];
  isPublic: boolean;
};

type StorageUploadResult = {
  storagePath: string;
  publicUrl?: string;
};

const bucketConfigs: Record<StorageBucket, BucketConfig> = {
  avatars: {
    maxSize: 2 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    isPublic: true,
  },
  'company-logos': {
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    isPublic: true,
  },
  cvs: {
    maxSize: 10 * 1024 * 1024,
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    allowedExts: ['.pdf', '.doc', '.docx'],
    isPublic: false,
  },
  'chat-files': {
    maxSize: 20 * 1024 * 1024,
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    allowedExts: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'],
    isPublic: false,
  },
};

const cleanupTempFile = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Failed to remove temp file ${filePath}:`, error);
  }
};

const assertValidFile = (
  file: Express.Multer.File,
  bucket: StorageBucket,
  config: BucketConfig,
) => {
  if (file.size > config.maxSize) {
    const maxSizeMB = config.maxSize / (1024 * 1024);
    throw new AppError(400, `File exceeds ${maxSizeMB}MB limit`);
  }

  const fileExt = path.extname(file.originalname).toLowerCase();
  const isValidType = config.allowedTypes.includes(file.mimetype);
  const isValidExt = config.allowedExts.includes(fileExt);

  if (!isValidType || !isValidExt) {
    throw new AppError(
      400,
      `Invalid file type for ${bucket}. Allowed extensions: ${config.allowedExts.join(', ')}`,
    );
  }
};

export const storageService = {
  async uploadFile(
    file: Express.Multer.File,
    bucket: StorageBucket,
  ): Promise<StorageUploadResult> {
    const config = bucketConfigs[bucket];

    try {
      assertValidFile(file, bucket, config);

      const fileExt = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
      const fileBuffer = fs.readFileSync(file.path);

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(uniqueName, fileBuffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new AppError(500, `Supabase upload failed: ${error.message}`);
      }

      const result: StorageUploadResult = {
        storagePath: data.path,
      };

      if (config.isPublic) {
        const { data: publicUrlData } = supabaseAdmin.storage
          .from(bucket)
          .getPublicUrl(data.path);

        result.publicUrl = publicUrlData.publicUrl;
      }

      return result;
    } finally {
      cleanupTempFile(file.path);
    }
  },

  async deleteFile(storagePath: string | null | undefined, bucket: StorageBucket) {
    if (!storagePath) return;

    const { error } = await supabaseAdmin.storage.from(bucket).remove([storagePath]);
    if (error) {
      console.error(`Failed to delete ${storagePath} from ${bucket}:`, error.message);
    }
  },

  async createSignedUrl(
    storagePath: string,
    bucket: StorageBucket,
    expiresIn = 600,
  ) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      throw new AppError(500, `Could not create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  },

  cleanupTempFile,
};
