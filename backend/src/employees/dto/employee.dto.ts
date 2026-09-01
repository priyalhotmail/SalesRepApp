import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const statuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;
const categories = ["DRIVER", "SALES_REP", "MANAGER", "WAREHOUSE_OFFICER", "OTHER"] as const;
const employmentTypes = ["PERMANENT", "CONTRACT", "TEMPORARY"] as const;

export class EmployeeQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];
}

export class CreateEmployeeDto {
  @Type(() => Number)
  @IsInt()
  userId!: number;

  @Type(() => Number)
  @IsInt()
  officeId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @Type(() => Number)
  @IsInt()
  warehouseId!: number;

  @IsOptional()
  @IsIn(categories)
  category?: (typeof categories)[number];

  @IsOptional()
  @IsIn(employmentTypes)
  employmentType?: (typeof employmentTypes)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  officeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @IsIn(categories)
  category?: (typeof categories)[number];

  @IsOptional()
  @IsIn(employmentTypes)
  employmentType?: (typeof employmentTypes)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];
}
