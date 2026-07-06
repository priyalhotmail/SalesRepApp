import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;

export class FreeItemOfferQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;
}

export class CreateFreeItemOfferDto {
  @IsInt()
  productId!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  buyQuantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  freeQuantity!: number;

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validTo!: string;
}

export class UpdateFreeItemOfferDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  buyQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  freeQuantity?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

