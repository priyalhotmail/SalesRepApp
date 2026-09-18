import { Type } from "class-transformer";
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const paymentMethods = ["CASH", "CHEQUE", "BANK_TRANSFER", "CARD"] as const;
const paymentStatuses = [
  "TEMPORARY",
  "AWAITING_CLEARANCE",
  "POSTED",
  "CANCELLED",
] as const;

export class PaymentQueryDto extends PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) collectorId?: number;
  @IsOptional() @IsDateString() date?: string;

  @IsOptional()
  @IsIn(paymentStatuses)
  status?: (typeof paymentStatuses)[number];

  @IsOptional()
  @IsIn(paymentMethods)
  method?: (typeof paymentMethods)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesInvoiceId?: number;
}

export class ChequePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  chequeNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  branchName?: string;

  @IsOptional()
  @IsDateString()
  chequeDate?: string;
}

export class PaymentAllocationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  invoiceId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}

export class CreatePaymentDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  allocations?: PaymentAllocationDto[];

  @Type(() => Number)
  @IsInt()
  customerId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesInvoiceId?: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsIn(paymentMethods)
  method!: (typeof paymentMethods)[number];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChequePaymentDto)
  cheque?: ChequePaymentDto;
}

export class CancelPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ConfirmPaymentDto extends ChequePaymentDto {}
