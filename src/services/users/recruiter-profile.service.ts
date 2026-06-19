import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { storageService } from '../storage/storage.service';

/**
 * Service quản lý hồ sơ nhà tuyển dụng (profile công ty)
 * 
 * Cung cấp các phương thức:
 * - findByUserId()  : tìm profile theo userId
 * - upsert()         : tạo mới hoặc cập nhật thông tin công ty
 * - replaceLogo()    : upload và thay thế logo công ty
 */

/** Kiểu dữ liệu đầu vào cho thông tin hồ sơ nhà tuyển dụng */
type RecruiterProfileInput = {
  companyName: string;       // Tên công ty (bắt buộc)
  contactName?: string | null;  // Người liên hệ
  phone?: string | null;        // Số điện thoại
  address?: string | null;      // Địa chỉ
  website?: string | null;      // Website
  description?: string | null;  // Mô tả doanh nghiệp
};

export const recruiterProfileService = {
  /**
   * Tìm hồ sơ nhà tuyển dụng theo user ID
   * 
   * @param userId - ID của user (recruiter)
   * @returns RecruiterProfile
   * @throws AppError 404 nếu chưa có hồ sơ
   */
  async findByUserId(userId: number) {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new AppError(404, 'Hồ sơ nhà tuyển dụng không tồn tại');
    }

    return profile;
  },

  /**
   * Tạo mới hoặc cập nhật hồ sơ (upsert)
   * 
   * Vì mỗi user chỉ có 1 profile nên dùng upsert:
   * - Nếu chưa có: tạo mới (CREATE)
   * - Nếu đã có: cập nhật (UPDATE)
   * 
   * @param userId - ID của user
   * @param data - thông tin hồ sơ cần lưu
   * @returns RecruiterProfile đã upsert
   */
  async upsert(userId: number, data: RecruiterProfileInput) {
    return prisma.recruiterProfile.upsert({
      where: { userId },
      create: {
        userId,
        companyName: data.companyName,
        contactName: data.contactName ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        website: data.website ?? null,
        description: data.description ?? null,
      },
      update: {
        companyName: data.companyName,
        contactName: data.contactName ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        website: data.website ?? null,
        description: data.description ?? null,
      },
    });
  },

  /**
   * Thay thế logo công ty
   * 
   * Flow chi tiết:
   * 1. Kiểm tra hồ sơ đã tồn tại chưa
   * 2. Upload file logo lên Supabase Storage (folder 'company-logos')
   * 3. Cập nhật DB với URL và storage path mới
   * 4. Nếu cập nhật DB lỗi: xóa file vừa upload (rollback)
   * 5. Nếu có logo cũ và khác logo mới: xóa file cũ
   * 
   * @param userId - ID của user
   * @param file - file logo từ multer
   * @returns { logoUrl, logoStoragePath }
   * @throws AppError 404 nếu chưa có hồ sơ
   */
  async replaceLogo(userId: number, file: Express.Multer.File) {
    // Bước 1: Kiểm tra hồ sơ đã tồn tại chưa
    const existing = await prisma.recruiterProfile.findUnique({
      where: { userId },
      select: { logoStoragePath: true },
    });

    if (!existing) {
      // Xóa file tạm nếu hồ sơ chưa tồn tại
      storageService.cleanupTempFile(file.path);
      throw new AppError(404, 'Hồ sơ nhà tuyển dụng không tồn tại');
    }

    // Bước 2: Upload file lên Supabase Storage
    const uploadResult = await storageService.uploadFile(file, 'company-logos');

    // Bước 3: Cập nhật DB
    let profile;
    try {
      profile = await prisma.recruiterProfile.update({
        where: { userId },
        data: {
          logoUrl: uploadResult.publicUrl || null,
          logoStoragePath: uploadResult.storagePath,
        },
        select: {
          logoUrl: true,
          logoStoragePath: true,
        },
      });
    } catch (error) {
      // Rollback: xóa file vừa upload nếu lỗi DB
      await storageService.deleteFile(uploadResult.storagePath, 'company-logos');
      throw error;
    }

    // Bước 4: Xóa logo cũ nếu có (và khác logo mới)
    if (
      existing.logoStoragePath &&
      existing.logoStoragePath !== uploadResult.storagePath
    ) {
      await storageService.deleteFile(existing.logoStoragePath, 'company-logos');
    }

    return profile;
  },
};
