import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";

const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export class CreateFactoryDto {
  @IsOptional()
  @IsInt()
  companyId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]+$/)
  @MaxLength(40)
  code?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  telephone?: string;
}

export class UpdateFactoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  telephone?: string;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}
