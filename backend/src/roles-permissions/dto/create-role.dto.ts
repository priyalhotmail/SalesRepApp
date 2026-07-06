import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";

export class CreateRoleDto {
  @IsString()
  @Matches(/^[A-Z0-9_]+$/, {
    message: "code must contain only uppercase letters, numbers, and underscores"
  })
  @MaxLength(80)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  permissionIds?: number[];
}

