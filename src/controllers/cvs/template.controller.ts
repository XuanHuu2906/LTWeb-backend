import { Request, Response } from 'express';
import * as templateService from '../../services/cvs/template.service';
import { successResponse, messageResponse } from '../../common/response';
import { AppError } from '../../middleware/errorHandler';

export const getTemplates = async (req: Request, res: Response) => {
  const isActiveOnly = req.query.isActive !== 'false';
  const templates = await templateService.findAll(isActiveOnly);
  res.json(successResponse(templates));
};

export const createTemplate = async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const template = await templateService.create(adminId, req.body);
  res.status(201).json(successResponse(template, 'Tạo template thành công'));
};

export const updateTemplate = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) throw new AppError(400, 'ID không hợp lệ');
  const template = await templateService.update(id, req.body);
  res.json(successResponse(template, 'Cập nhật template thành công'));
};

export const deleteTemplate = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) throw new AppError(400, 'ID không hợp lệ');
  await templateService.remove(id);
  res.json(messageResponse('Xóa template thành công'));
};

export const toggleTemplate = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) throw new AppError(400, 'ID không hợp lệ');
  const template = await templateService.toggle(id);
  res.json(successResponse(template, `Template đã được ${template.isActive ? 'kích hoạt' : 'vô hiệu hóa'}`));
};
