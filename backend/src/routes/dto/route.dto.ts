import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;
const scheduleStatuses = ["ACTIVE", "INACTIVE", "DELETED"] as const;
const daysOfWeek = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
] as const;

export class RouteQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  officeId?: number;
}

export class CreateRouteDto {
  @Type(() => Number)
  @IsInt()
  officeId!: number;

  @IsOptional() @Type(() => Number) @IsInt() driverId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]+$/)
  @MaxLength(40)
  code?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateRouteDto {
  @IsOptional() @Type(() => Number) @IsInt() driverId?: number;
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];
}

export class AssignRouteCustomersDto {
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  customerIds!: number[];
}

export class CreateRouteScheduleDto {
  @IsIn(daysOfWeek)
  dayOfWeek!: (typeof daysOfWeek)[number];

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  plannedTime?: string;
}

export class UpdateRouteScheduleDto {
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  plannedTime?: string;

  @IsOptional()
  @IsIn(scheduleStatuses)
  status?: (typeof scheduleStatuses)[number];
}
