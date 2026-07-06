import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const editableStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telephone?: string;

  @IsOptional()
  @IsIn(editableStatuses)
  status?: (typeof editableStatuses)[number];
}

