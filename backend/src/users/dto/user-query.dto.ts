import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const userStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"] as const;

export class UserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(userStatuses)
  status?: (typeof userStatuses)[number];
}

