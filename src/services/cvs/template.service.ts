import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export const findAll = async (isActiveOnly = true) => {
  return prisma.cVTemplate.findMany({
    where: isActiveOnly ? { isActive: true } : {},
    orderBy: { name: 'asc' },
  });
};

export const create = async (
  adminId: number,
  data: { name: string; description?: string; thumbnailUrl?: string; layoutConfig?: string }
) => {
  return prisma.cVTemplate.create({
    data: {
      name: data.name,
      description: data.description || null,
      thumbnailUrl: data.thumbnailUrl || null,
      layoutConfig: data.layoutConfig || null,
      createdBy: adminId,
    },
  });
};

export const update = async (
  id: number,
  data: { name?: string; description?: string; thumbnailUrl?: string; layoutConfig?: string }
) => {
  const template = await prisma.cVTemplate.findUnique({ where: { id } });
  if (!template) throw new AppError(404, 'Template không tồn tại');

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.thumbnailUrl !== undefined) updateData.thumbnailUrl = data.thumbnailUrl;
  if (data.layoutConfig !== undefined) updateData.layoutConfig = data.layoutConfig;

  return prisma.cVTemplate.update({ where: { id }, data: updateData });
};

export const remove = async (id: number) => {
  const template = await prisma.cVTemplate.findUnique({ where: { id } });
  if (!template) throw new AppError(404, 'Template không tồn tại');

  const cvCount = await prisma.cV.count({ where: { templateId: id } });
  if (cvCount > 0) {
    throw new AppError(400, 'Không thể xóa template đang được sử dụng bởi CV');
  }

  await prisma.cVTemplate.delete({ where: { id } });
};

export const toggle = async (id: number) => {
  const template = await prisma.cVTemplate.findUnique({ where: { id } });
  if (!template) throw new AppError(404, 'Template không tồn tại');

  return prisma.cVTemplate.update({
    where: { id },
    data: { isActive: !template.isActive },
  });
};
