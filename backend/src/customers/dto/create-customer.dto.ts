import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
  MinLength
} from "class-validator";
import { Type } from "class-transformer";

const customerTypes = ["BUSINESS", "INDIVIDUAL"] as const;

export class CreateCustomerDto {
  @IsInt()
  officeId!: number;

  @IsOptional()
  @IsInt()
  salesRepId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]+$/)
  @MaxLength(40)
  code?: string;

  @IsIn(customerTypes)
  customerType!: (typeof customerTypes)[number];

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  vatRegistrationNumber?: string;

  @IsOptional()
  @IsString()
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
  @IsString()
  @MaxLength(160)
  contactPerson?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  geoAccuracyMeters?: number;
}
