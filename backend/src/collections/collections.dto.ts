import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
export class CollectionQuery extends PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) officeId?: number;
}
export class SendCollectionDto {
  @Type(() => Number) @IsInt() @Min(1) officeId!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsInt({ each: true })
  paymentIds!: number[];
  @IsIn(["HEAD_OFFICE", "BANK"]) destination!: string;
  @IsDateString() sentAt!: string;
  @IsString() @MaxLength(160) reference!: string;
  @IsOptional() @IsString() @MaxLength(160) bankName?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
export class ReviewCollectionDto {
  @IsIn(["RECEIVED", "NOT_RECEIVED"]) status!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
