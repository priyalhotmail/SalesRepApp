import { Type } from "class-transformer";
import {
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

const paymentMethods = ["CASH", "CHEQUE", "BANK_TRANSFER", "CARD"] as const;
const paymentStatuses = ["POSTED", "CANCELLED"] as const;

export class PaymentQueryDto extends PaginationQueryDto {
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
  @IsString()
  @MaxLength(80)
  chequeNumber!: string;

  @IsString()
  @MaxLength(160)
  bankName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  branchName?: string;

  @IsDateString()
  chequeDate!: string;
}

export class CreatePaymentDto {
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
  @IsNumber()
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
