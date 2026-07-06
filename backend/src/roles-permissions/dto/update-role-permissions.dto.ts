import { Type } from "class-transformer";
import { ArrayUnique, IsArray, IsInt } from "class-validator";

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  permissionIds!: number[];
}

