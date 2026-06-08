export interface PaginationParams {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export const getPagination = (query: {
  page?: string;
  limit?: string;
}): PaginationParams => {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit || '10', 10)));
  return { skip: (page - 1) * limit, take: limit, page, limit };
};
