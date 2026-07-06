import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;
const valueTypes = ["STRING", "NUMBER", "BOOLEAN", "JSON"] as const;

export class SystemSettingQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

export class UpsertSystemSettingDto {
  @IsDefined()
  value!: unknown;

  @IsIn(valueTypes)
  valueType!: (typeof valueTypes)[number];

  @IsString()
  @MaxLength(80)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isSensitive?: boolean;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}
