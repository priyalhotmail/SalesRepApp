import { Type } from "class-transformer";
import { ArrayUnique, IsArray, IsInt } from "class-validator";

export class AssignUserRolesDto {
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  roleIds!: number[];
}

