import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const unitTypes = ["GM", "KG", "ML", "L"] as const;
const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;

export class ProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productGroupId?: number;
}

export class CreateProductDto {
  @IsInt()
  productGroupId!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]+$/)
  @MaxLength(40)
  code?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacity!: number;

  @IsIn(unitTypes)
  unitType!: (typeof unitTypes)[number];

  @IsOptional()
  @IsBoolean()
  supportsBulk?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsInt()
  productGroupId?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsIn(unitTypes)
  unitType?: (typeof unitTypes)[number];

  @IsOptional()
  @IsBoolean()
  supportsBulk?: boolean;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

export class BulkPackagingCalculationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  unitsPerPackage!: number;
}
