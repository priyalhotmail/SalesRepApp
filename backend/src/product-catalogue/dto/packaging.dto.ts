import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export class CreatePackagingOptionDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitQuantity!: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdatePackagingOptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitQuantity?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

