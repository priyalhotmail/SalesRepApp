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

const officeTypes = ["MAIN", "BRANCH"] as const;
const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export class CreateOfficeDto {
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

  @IsIn(officeTypes)
  officeType!: (typeof officeTypes)[number];

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

export class UpdateOfficeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(officeTypes)
  officeType?: (typeof officeTypes)[number];

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
