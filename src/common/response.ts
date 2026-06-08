export const successResponse = (data?: any, message?: string) => ({
  success: true,
  data,
  message: message || 'Thành công',
});

export const paginatedResponse = (
  data: any[],
  pagination: { page: number; limit: number; total: number }
) => ({
  success: true,
  data,
  pagination,
});

export const messageResponse = (message: string) => ({
  success: true,
  message,
});
