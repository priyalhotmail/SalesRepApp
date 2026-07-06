import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
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

const transferStatuses = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "DISPATCHED",
  "IN_TRANSIT",
  "RECEIVED",
  "CANCELLED"
] as const;

export class WarehouseTransferQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(transferStatuses)
  status?: (typeof transferStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fromWarehouseId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  toWarehouseId?: number;
}

export class WarehouseTransferItemDto {
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  requestedQuantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateWarehouseTransferDto {
  @Type(() => Number)
  @IsInt()
  fromWarehouseId!: number;

  @Type(() => Number)
  @IsInt()
  toWarehouseId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WarehouseTransferItemDto)
  items!: WarehouseTransferItemDto[];
}

export class WarehouseTransferApprovalItemDto {
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  approvedQuantity!: number;
}

export class ApproveWarehouseTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WarehouseTransferApprovalItemDto)
  items?: WarehouseTransferApprovalItemDto[];
}

export class ReceiveWarehouseTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WarehouseTransferApprovalItemDto)
  items?: WarehouseTransferApprovalItemDto[];
}

export class WarehouseTransferNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
