import { PaginationQueryDto } from "../dto/pagination-query.dto";

export type PaginatedResult<T> = {
  data: T[];
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

export function getPagination(query: PaginationQueryDto) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  return {
    limit,
    page,
    skip: (page - 1) * limit,
    take: limit
  };
}

export function toPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  return {
    data,
    meta: {
      limit,
      page,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

