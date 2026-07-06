import { Type } from "class-transformer";
import { ArrayUnique, IsArray, IsInt } from "class-validator";

export class AssignProductFactoriesDto {
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  factoryIds!: number[];
}

