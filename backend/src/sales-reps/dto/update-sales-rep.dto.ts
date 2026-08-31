import { Type } from "class-transformer";
import { IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const salesRepStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

export class UpdateSalesRepDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  officeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(80)
  nic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  telephone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string;

  @IsOptional()
  @IsIn(salesRepStatuses)
  status?: (typeof salesRepStatuses)[number];
}
