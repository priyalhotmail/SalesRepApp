import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const approvalStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

export class UpdateCustomerCreditDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsBoolean()
  creditHold?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  creditTermsDays?: number;
}

export class CreditCheckDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orderAmount?: number;
}

export class CreditAgingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;
}

export class CreditOverrideRequestQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(approvalStatuses)
  status?: (typeof approvalStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;
}

export class CreateCreditOverrideRequestDto {
  @Type(() => Number)
  @IsInt()
  customerId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  requestedAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReviewCreditOverrideRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
