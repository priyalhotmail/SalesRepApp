import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const roleStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsIn(roleStatuses)
  status?: (typeof roleStatuses)[number];
}

