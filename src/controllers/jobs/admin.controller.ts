import { Request, Response } from 'express';
import * as adminService from '../../services/jobs/admin.service';
import { paginatedResponse, messageResponse } from '../../common/response';
import { getPagination } from '../../common/paginate';
import { AppError } from '../../middleware/errorHandler';

export const getAllJobs = async (req: Request, res: Response) => {
  const { page, limit, status, recruiterId, search } = req.query;
  const pagination = getPagination({ page: page as string, limit: limit as string });
  const filters = {
    status: status as string | undefined,
    recruiterId: recruiterId as string | undefined,
    search: search as string | undefined,
  };

  const { jobs, total } = await adminService.findAll(filters, pagination);
  res.json(paginatedResponse(jobs, { page: pagination.page, limit: pagination.limit, total }));
};

export const forceDeleteJob = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) throw new AppError(400, 'ID không hợp lệ');
  await adminService.softDelete(id);
  res.json(messageResponse('Xóa job thành công'));
};
