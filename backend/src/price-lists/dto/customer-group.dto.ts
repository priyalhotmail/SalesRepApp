import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;

export class CustomerGroupQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

export class CreateCustomerGroupDto {
  @IsString()
  @Matches(/^[A-Z0-9-]+$/)
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateCustomerGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

export class AssignCustomersToGroupDto {
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  customerIds!: number[];
}

