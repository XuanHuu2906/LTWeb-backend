import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';

type CVInput = {
  title?: string;
  personalInfo?: unknown;
  education?: unknown;
  experience?: unknown;
  skills?: unknown;
  certifications?: unknown;
  projects?: unknown;
  templateId?: number;
};

const jsonFields = [
  'personalInfo',
  'education',
  'experience',
  'skills',
  'certifications',
  'projects',
] as const;

const stringifyJsonFields = (data: CVInput) => {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (jsonFields.includes(key as (typeof jsonFields)[number])) {
      payload[key] = typeof value === 'string' ? value : JSON.stringify(value);
      continue;
    }

    payload[key] = value;
  }

  return payload;
};

const parseJsonValue = (value: unknown) => {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const parseCvJsonFields = <T extends Record<string, any> | null>(cv: T): T => {
  if (!cv) return cv;

  const parsed = { ...cv };
  for (const field of jsonFields) {
    if (field in parsed) {
      parsed[field] = parseJsonValue(parsed[field]);
    }
  }

  return parsed as T;
};

const ensureOwnership = (cv: { userId: number }, userId: number) => {
  if (cv.userId !== userId) {
    throw new AppError(403, 'Bạn không có quyền thao tác CV này');
  }
};

export const cvService = {
  async findAllByUserId(userId: number) {
    const cvs = await prisma.cV.findMany({
      where: { userId, deletedAt: null },
      include: { template: { select: { name: true, thumbnailUrl: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return cvs.map(parseCvJsonFields);
  },

  async create(userId: number, data: CVInput) {
    const {
      title = 'CV của tôi',
      personalInfo,
      education,
      experience,
      skills,
      certifications,
      projects,
      templateId,
    } = data;

    const cv = await prisma.cV.create({
      data: {
        userId,
        title,
        templateId,
        cvType: 'built',
        ...stringifyJsonFields({
          personalInfo,
          education,
          experience,
          skills,
          certifications,
          projects,
        }),
      },
    });

    return parseCvJsonFields(cv);
  },

  async findById(id: number) {
    const cv = await prisma.cV.findFirst({
      where: { id, deletedAt: null },
      include: { template: true },
    });

    if (!cv) {
      throw new AppError(404, 'CV không tồn tại');
    }

    return parseCvJsonFields(cv);
  },

  async update(id: number, userId: number, data: CVInput) {
    const existing = await this.findById(id);
    ensureOwnership(existing, userId);

    const cv = await prisma.cV.update({
      where: { id },
      data: stringifyJsonFields(data),
    });

    return parseCvJsonFields(cv);
  },

  async delete(id: number, userId: number) {
    const existing = await this.findById(id);
    ensureOwnership(existing, userId);

    await prisma.cV.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async uploadPdf(userId: number, file?: Express.Multer.File) {
    if (!file) {
      throw new AppError(400, 'Vui lòng chọn file PDF');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new AppError(400, 'File upload phải là PDF');
    }

    const title = file.originalname.replace(/\.pdf$/i, '') || 'CV upload';

    const cv = await prisma.cV.create({
      data: {
        userId,
        title,
        cvType: 'uploaded',
        pdfUrl: file.path,
        status: 'active',
      },
    });

    return parseCvJsonFields(cv);
  },

  async updateStatus(id: number, userId: number, status: 'draft' | 'active') {
    if (status !== 'draft' && status !== 'active') {
      throw new AppError(400, 'Trạng thái CV không hợp lệ');
    }

    const existing = await this.findById(id);
    ensureOwnership(existing, userId);

    if (status === 'active') {
      await prisma.cV.updateMany({
        where: { userId, id: { not: id }, deletedAt: null },
        data: { status: 'draft' },
      });
    }

    const cv = await prisma.cV.update({
      where: { id },
      data: { status },
    });

    return parseCvJsonFields(cv);
  },
};
