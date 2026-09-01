import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const deliveryStatuses = [
  "PLANNED",
  "DISPATCHED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "CANCELLED"
] as const;

export class DeliveryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  driverId?: number;
}

export class CreateDeliveryDto {
  @Type(() => Number)
  @IsInt()
  orderId!: number;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  driverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ConfirmDeliveryItemDto {
  @Type(() => Number)
  @IsInt()
  deliveryItemId!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deliveredQuantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rejectedQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ConfirmDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  receivedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  proofNotes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmDeliveryItemDto)
  items!: ConfirmDeliveryItemDto[];
}

export class DeliveryNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class DeliveryPlanQueryDto extends PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() routeId?: number;
}

export class DeliveryPlanEligibleOrdersQueryDto extends PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() routeId?: number;
}

export class DeliveryPlanSummaryQueryDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === "string" ? value.split(",").map(Number).filter(Number.isInteger) : [])
  @IsArray()
  @IsInt({ each: true })
  orderIds: number[] = [];
}

export class CreateDeliveryPlanDto {
  @Type(() => Number) @IsInt() routeId!: number;
  @Type(() => Number) @IsInt() driverId!: number;
  @IsDateString() plannedDate!: string;
  @IsArray() @ArrayMinSize(1) @Type(() => Number) @IsInt({ each: true }) orderIds!: number[];
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
