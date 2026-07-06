import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const roleStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;

export class RoleQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(roleStatuses)
  status?: (typeof roleStatuses)[number];
}

