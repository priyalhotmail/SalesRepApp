import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const invoiceStatuses = [
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED"
] as const;

export class SalesInvoiceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(invoiceStatuses)
  status?: (typeof invoiceStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;
}

export class CreateInvoiceFromOrderDto {
  @Type(() => Number)
  @IsInt()
  orderId!: number;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelSalesInvoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
