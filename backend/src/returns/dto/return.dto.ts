import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const returnStatuses = [
  "REQUESTED",
  "APPROVED",
  "RECEIVED",
  "REJECTED",
  "CANCELLED"
] as const;

export class SalesReturnQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(returnStatuses)
  status?: (typeof returnStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesInvoiceId?: number;
}

export class SalesReturnLineDto {
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateSalesReturnDto {
  @Type(() => Number)
  @IsInt()
  customerId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesInvoiceId?: number;

  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesReturnLineDto)
  items!: SalesReturnLineDto[];
}

export class ReviewSalesReturnDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

export class ReceiveSalesReturnDto extends ReviewSalesReturnDto {
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;
}
