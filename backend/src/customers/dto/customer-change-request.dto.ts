import { Type } from "class-transformer";
import { IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const approvalStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

export class CreateCustomerChangeRequestDto {
  @IsObject()
  requestedChanges!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReviewCustomerChangeRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

export class CustomerChangeRequestQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(approvalStatuses)
  status?: (typeof approvalStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;
}

