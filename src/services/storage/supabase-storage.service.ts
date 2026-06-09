import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/errorHandler';

// Cấu hình các Bucket theo yêu cầu từ User
const BUCKET_CONFIGS: Record<string, { maxSize: number; allowedTypes: string[]; allowedExts: string[] }> = {
  'avatars': {
    maxSize: 2 * 1024 * 1024, // 2MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  'company-logos': {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  'cvs': {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    allowedExts: ['.pdf', '.doc', '.docx'],
  },
  'chat-files': {
    maxSize: 20 * 1024 * 1024, // 20MB
    allowedTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    allowedExts: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'],
  },
};

export const supabaseStorageService = {
  /**
   * Tải file từ multer temp path lên Supabase Storage và xóa file tạm
   */
  async uploadFile(
    file: Express.Multer.File,
    bucket: string,
  ): Promise<{ storagePath: string; publicUrl?: string }> {
    const config = BUCKET_CONFIGS[bucket];
    if (!config) {
      // Xóa file tạm trước khi ném lỗi
      this.cleanupTempFile(file.path);
      throw new AppError(400, `Bucket '${bucket}' không được hỗ trợ cấu hình`);
    }

    // 1. Validate File Size
    if (file.size > config.maxSize) {
      this.cleanupTempFile(file.path);
      const maxSizeMB = config.maxSize / (1024 * 1024);
      throw new AppError(400, `Kích thước tệp vượt quá giới hạn cho phép của bucket ${bucket} (${maxSizeMB}MB)`);
    }

    // 2. Validate MIME Type & Extension
    const fileExt = path.extname(file.originalname).toLowerCase();
    const isValidType = config.allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('image/') && bucket === 'avatars';
    const isValidExt = config.allowedExts.includes(fileExt);

    if (!isValidType || !isValidExt) {
      this.cleanupTempFile(file.path);
      throw new AppError(400, `Định dạng tệp không hợp lệ cho bucket ${bucket}. Chỉ chấp nhận: ${config.allowedExts.join(', ')}`);
    }

    try {
      // Read file buffer
      const fileBuffer = fs.readFileSync(file.path);
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
      const storagePath = uniqueName;

      // 3. Upload to Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new AppError(500, `Lỗi khi tải tệp lên Supabase Storage: ${error.message}`);
      }

      const result: { storagePath: string; publicUrl?: string } = {
        storagePath: data.path,
      };

      // 4. If bucket is public, get publicUrl
      if (bucket === 'avatars' || bucket === 'company-logos') {
        const { data: publicUrlData } = supabaseAdmin.storage
          .from(bucket)
          .getPublicUrl(data.path);
        result.publicUrl = publicUrlData.publicUrl;
      }

      return result;
    } catch (err: any) {
      throw err instanceof AppError ? err : new AppError(500, `Lỗi không xác định khi xử lý tệp: ${err.message}`);
    } finally {
      // 5. Luôn dọn dẹp file tạm ở đĩa cục bộ
      this.cleanupTempFile(file.path);
    }
  },

  /**
   * Xóa file khỏi Supabase Storage
   */
  async deleteFile(storagePath: string, bucket: string): Promise<void> {
    const { error } = await supabaseAdmin.storage.from(bucket).remove([storagePath]);
    if (error) {
      console.error(`Lỗi khi xóa tệp ${storagePath} trong bucket ${bucket}:`, error.message);
    }
  },

  /**
   * Tạo Signed URL ngắn hạn (mặc định 600 giây - 10 phút) cho tệp private
   */
  async createSignedUrl(
    storagePath: string,
    bucket: string,
    expiresIn = 600,
  ): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      throw new AppError(500, `Không thể tạo đường dẫn truy cập tệp: ${error.message}`);
    }

    return data.signedUrl;
  },

  /**
   * Dọn dẹp tệp tạm thời trên ổ đĩa cục bộ
   */
  cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Lỗi khi xóa tệp tạm ${filePath}:`, err);
    }
  },
};
