import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;

export class SalesTargetQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesRepId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  targetYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  targetMonth?: number;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

export class CreateSalesTargetDto {
  @Type(() => Number)
  @IsInt()
  salesRepId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  targetYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  targetMonth!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  revenueTarget!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  volumeTarget!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateSalesTargetDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  revenueTarget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  volumeTarget?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

export class SalesTargetPerformanceQueryDto {
  @Type(() => Number)
  @IsInt()
  salesRepId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  targetYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  targetMonth!: number;
}
