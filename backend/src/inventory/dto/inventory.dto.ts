import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const reservationStatuses = ["ACTIVE", "RELEASED", "CONSUMED", "CANCELLED"] as const;

export class InventoryStockQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;
}

export class InventoryMovementQueryDto extends InventoryStockQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  referenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string;
}

export class StockReservationQueryDto extends InventoryStockQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;

  @IsOptional()
  @IsIn(reservationStatuses)
  status?: (typeof reservationStatuses)[number];
}

export class AdjustInventoryDto {
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;

  @Type(() => Number)
  @IsInt()
  productId!: number;

  @Type(() => Number)
  @IsNumber()
  quantityChange!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateStockReservationDto {
  @Type(() => Number)
  @IsInt()
  warehouseId!: number;

  @Type(() => Number)
  @IsInt()
  productId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ReleaseStockReservationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
