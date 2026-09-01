import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;
const officeTypes = ["MAIN", "BRANCH"] as const;

export class StructureQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];

  @IsOptional()
  @IsIn(officeTypes)
  officeType?: (typeof officeTypes)[number];
}
