import { Type } from "class-transformer";
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
  @IsIn(deliveryStatuses)
  status?: (typeof deliveryStatuses)[number];

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
