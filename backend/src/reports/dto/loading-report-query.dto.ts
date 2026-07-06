import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional } from "class-validator";

export class LoadingReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
