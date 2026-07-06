import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const ownerTypes = [
  "CUSTOMER",
  "ORDER",
  "DELIVERY",
  "SALES_INVOICE",
  "PAYMENT",
  "CHEQUE",
  "RETURN",
  "CUSTOMER_VISIT",
  "PRODUCT",
  "WAREHOUSE_TRANSFER"
] as const;

export class AttachmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ownerTypes)
  ownerType?: (typeof ownerTypes)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ownerId?: number;
}

export class CreateAttachmentDto {
  @IsIn(ownerTypes)
  ownerType!: (typeof ownerTypes)[number];

  @Type(() => Number)
  @IsInt()
  ownerId!: number;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSize!: number;

  @IsString()
  @MaxLength(500)
  storagePath!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string;
}
