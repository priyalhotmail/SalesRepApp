import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const chequeStatuses = [
  "RECEIVED",
  "DEPOSITED",
  "REALIZED",
  "RETURNED",
  "CANCELLED"
] as const;

export class ChequeQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(chequeStatuses)
  status?: (typeof chequeStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesInvoiceId?: number;
}

export class ReturnChequeDto {
  @IsString()
  @MaxLength(500)
  returnedReason!: string;
}
