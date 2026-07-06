import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const salesRepStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"] as const;

export class SalesRepQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(salesRepStatuses)
  status?: (typeof salesRepStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  officeId?: number;
}

