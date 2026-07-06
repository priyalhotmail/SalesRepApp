import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;

export class DiscountClassQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

export class CreateDiscountClassDto {
  @IsString()
  @Matches(/^[A-Z0-9-]+$/)
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage!: number;
}

export class UpdateDiscountClassDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

export class AssignCustomerDiscountDto {
  @IsInt()
  customerId!: number;

  @IsInt()
  discountClassId!: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

