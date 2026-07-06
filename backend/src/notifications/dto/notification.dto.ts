import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const notificationTypes = ["INFO", "SUCCESS", "WARNING", "ERROR"] as const;
const notificationStatuses = ["UNREAD", "READ", "ARCHIVED"] as const;

export class NotificationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsIn(notificationStatuses)
  status?: (typeof notificationStatuses)[number];
}

export class CreateNotificationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @IsIn(notificationTypes)
  type?: (typeof notificationTypes)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  module?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityId?: string;
}
