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

const requestStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "USED"] as const;

export class AdditionalDiscountRequestQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(requestStatuses)
  status?: (typeof requestStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;
}

export class CreateAdditionalDiscountRequestDto {
  @IsInt()
  customerId!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReviewAdditionalDiscountRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

