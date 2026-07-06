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
const runStatuses = ["DRAFT", "APPROVED", "PAID", "CANCELLED"] as const;

export class CommissionRuleQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesRepId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

export class CreateCommissionRuleDto {
  @IsString()
  @Matches(/^[A-Z0-9-]+$/)
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesRepId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ratePercentage!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPerUnit!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bonusThreshold!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bonusAmount!: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateCommissionRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ratePercentage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPerUnit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bonusThreshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bonusAmount?: number;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

export class CommissionRunQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesRepId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  periodYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @IsOptional()
  @IsIn(runStatuses)
  status?: (typeof runStatuses)[number];
}

export class CalculateCommissionRunDto {
  @Type(() => Number)
  @IsInt()
  salesRepId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  periodYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;
}
