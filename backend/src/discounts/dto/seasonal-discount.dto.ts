import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const valueTypes = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;

export class SeasonalDiscountQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;
}

export class CreateSeasonalDiscountDto {
  @IsInt()
  productId!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsIn(valueTypes)
  valueType!: (typeof valueTypes)[number];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000)
  value!: number;

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validTo!: string;
}

export class UpdateSeasonalDiscountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(valueTypes)
  valueType?: (typeof valueTypes)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000)
  value?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

