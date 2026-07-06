import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const customerTypes = ["BUSINESS", "INDIVIDUAL"] as const;
const recordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"] as const;

export class CustomerQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(recordStatuses)
  status?: (typeof recordStatuses)[number];

  @IsOptional()
  @IsIn(customerTypes)
  customerType?: (typeof customerTypes)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  officeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salesRepId?: number;
}

export class NearbyCustomerQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  radiusKm = 5;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
