import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "password must contain at least one letter and one number"
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telephone?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  roleIds?: number[];
}

