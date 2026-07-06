import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const orderStatuses = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "RESERVED",
  "LOADING",
  "DELIVERED",
  "CANCELLED",
  "AMENDMENT_PENDING"
] as const;

const editableOrderStatuses = ["DRAFT", "SUBMITTED"] as const;
const approvalStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

export class OrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(orderStatuses)
  status?: (typeof orderStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesRepId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  officeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class OrderLineDto {
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  packagingOptionId?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  freeQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]+$/)
  @MaxLength(40)
  orderNumber?: string;

  @Type(() => Number)
  @IsInt()
  customerId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesRepId?: number;

  @Type(() => Number)
  @IsInt()
  officeId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsIn(editableOrderStatuses)
  status?: (typeof editableOrderStatuses)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];
}

export class UpdateOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @IsIn(editableOrderStatuses)
  status?: (typeof editableOrderStatuses)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items?: OrderLineDto[];
}

export class CreateOrderAmendmentRequestDto {
  @IsObject()
  requestedChanges!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReviewOrderAmendmentRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

export class OrderAmendmentRequestQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;

  @IsOptional()
  @IsIn(approvalStatuses)
  status?: (typeof approvalStatuses)[number];
}
