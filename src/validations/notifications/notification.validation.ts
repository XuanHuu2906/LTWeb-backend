import { z } from 'zod';

export const getNotificationsSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/, 'trang phải là số nguyên dương').optional(),
    limit: z.string().regex(/^\d+$/, 'giới hạn phải là số nguyên dương').optional(),
    type: z.string().optional(),
  }),
};

export const markAsReadSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID thông báo phải là số nguyên dương'),
  }),
};
