import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const visitTypes = ["SALES", "COLLECTION", "COMPLAINT", "DELIVERY_FOLLOW_UP"] as const;
const visitStatuses = ["PLANNED", "COMPLETED", "MISSED", "CANCELLED"] as const;
const visitOutcomes = [
  "ORDER_PLACED",
  "NO_ORDER",
  "COLLECTION_RECEIVED",
  "COMPLAINT_RECORDED",
  "FOLLOW_UP_REQUIRED",
  "OTHER"
] as const;

export class CustomerVisitQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesRepId?: number;

  @IsOptional()
  @IsIn(visitTypes)
  visitType?: (typeof visitTypes)[number];

  @IsOptional()
  @IsIn(visitStatuses)
  status?: (typeof visitStatuses)[number];
}

export class CreateCustomerVisitDto {
  @Type(() => Number)
  @IsInt()
  customerId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesRepId?: number;

  @IsIn(visitTypes)
  visitType!: (typeof visitTypes)[number];

  @IsOptional()
  @IsDateString()
  plannedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CompleteCustomerVisitDto {
  @IsIn(visitOutcomes)
  outcome!: (typeof visitOutcomes)[number];

  @IsOptional()
  @IsDateString()
  visitedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  noOrderReason?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  collectionAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  complaintNotes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  geoAccuracyMeters?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class VisitNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
