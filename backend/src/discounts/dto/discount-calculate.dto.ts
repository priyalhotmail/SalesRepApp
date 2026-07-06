import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested
} from "class-validator";

export class DiscountCalculationLineDto {
  @IsInt()
  productId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class DiscountCalculationDto {
  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsInt()
  additionalDiscountRequestId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  cashDiscountPercentage?: number;

  @IsOptional()
  @IsBoolean()
  cashPaymentSelected?: boolean;

  @IsOptional()
  @IsDateString()
  calculationDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountCalculationLineDto)
  lines!: DiscountCalculationLineDto[];
}

