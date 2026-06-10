import { prisma } from "../../utils/prisma";
import { AppError } from "../../middleware/errorHandler";
import { deleteCacheByPattern, getOrSetCache } from "../../utils/cache";

const TEMPLATE_CACHE_PATTERN = "cv-templates:*";

const invalidateTemplateCache = () => deleteCacheByPattern(TEMPLATE_CACHE_PATTERN);

export const findAll = async (isActiveOnly = true) => {
  const cacheKey = isActiveOnly ? "cv-templates:active" : "cv-templates:all";
  return getOrSetCache(cacheKey, 5 * 60, () =>
    prisma.cVTemplate.findMany({
      where: isActiveOnly ? { isActive: true } : {},
      orderBy: { name: "asc" },
    }),
  );
};

export const create = async (
  adminId: number,
  data: {
    name: string;
    description?: string;
    thumbnailUrl?: string;
    layoutConfig?: string;
  },
) => {
  const template = await prisma.cVTemplate.create({
    data: {
      name: data.name,
      description: data.description || null,
      thumbnailUrl: data.thumbnailUrl || null,
      layoutConfig: data.layoutConfig || null,
      createdBy: adminId,
    },
  });

  await invalidateTemplateCache();
  return template;
};

export const update = async (
  id: number,
  data: {
    name?: string;
    description?: string;
    thumbnailUrl?: string;
    layoutConfig?: string;
  },
) => {
  const template = await prisma.cVTemplate.findUnique({ where: { id } });
  if (!template) throw new AppError(404, "Template không tồn tại");

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.thumbnailUrl !== undefined)
    updateData.thumbnailUrl = data.thumbnailUrl;
  if (data.layoutConfig !== undefined)
    updateData.layoutConfig = data.layoutConfig;

  const updatedTemplate = await prisma.cVTemplate.update({ where: { id }, data: updateData });
  await invalidateTemplateCache();
  return updatedTemplate;
};

export const remove = async (id: number) => {
  const template = await prisma.cVTemplate.findUnique({ where: { id } });
  if (!template) throw new AppError(404, "Template không tồn tại");

  const cvCount = await prisma.cV.count({ where: { templateId: id } });
  if (cvCount > 0) {
    throw new AppError(400, "Không thể xóa template đang được sử dụng bởi CV");
  }

  await prisma.cVTemplate.delete({ where: { id } });
  await invalidateTemplateCache();
};

export const toggle = async (id: number) => {
  const template = await prisma.cVTemplate.findUnique({ where: { id } });
  if (!template) throw new AppError(404, "Template không tồn tại");

  const updatedTemplate = await prisma.cVTemplate.update({
    where: { id },
    data: { isActive: !template.isActive },
  });

  await invalidateTemplateCache();
  return updatedTemplate;
};
