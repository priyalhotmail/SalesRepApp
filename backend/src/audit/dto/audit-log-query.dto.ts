import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class AuditLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actorUserId?: number;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class AuditLogExportQueryDto extends AuditLogQueryDto {
  @IsOptional()
  @IsIn(["json"])
  format?: "json";
}
