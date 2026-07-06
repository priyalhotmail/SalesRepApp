import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const priceListStatuses = ["DRAFT", "ACTIVE", "SCHEDULED", "ARCHIVED", "DELETED"] as const;
const assignmentScopes = ["GLOBAL", "CUSTOMER", "CUSTOMER_GROUP", "OFFICE"] as const;

export class PriceListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(priceListStatuses)
  status?: (typeof priceListStatuses)[number];
}

export class CreatePriceListDto {
  @IsOptional()
  @IsInt()
  companyId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]+$/)
  @MaxLength(40)
  code?: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdatePriceListDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsIn(priceListStatuses)
  status?: (typeof priceListStatuses)[number];
}

export class UpsertPriceListItemDto {
  @IsInt()
  productId!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreatePriceListAssignmentDto {
  @IsIn(assignmentScopes)
  scope!: (typeof assignmentScopes)[number];

  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsInt()
  customerGroupId?: number;

  @IsOptional()
  @IsInt()
  officeId?: number;
}

export class ResolvePriceDto {
  @IsInt()
  productId!: number;

  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsInt()
  officeId?: number;

  @IsOptional()
  @IsDateString()
  pricingDate?: string;
}
