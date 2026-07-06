import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString } from "class-validator";

export class ReportDateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  officeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesRepId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;
}

export class InventoryReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

export class DeliveryPerformanceQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;
}

export class SalesRepPerformanceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesRepId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  targetYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  targetMonth?: number;
}
