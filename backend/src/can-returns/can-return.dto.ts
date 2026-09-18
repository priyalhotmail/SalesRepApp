import { Type } from "class-transformer";
import {
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  Matches,
} from "class-validator";
export class CanTypeDto {
  @IsString() @MaxLength(80) name!: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  capacityLitres!: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  returnValue!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  productIds!: number[];
  @IsOptional() @IsBoolean() active?: boolean;
}
export class CanLineDto {
  @IsInt() @Min(1) canTypeId!: number;
  @IsInt() @Min(1) quantity!: number;
}
export class CreateCanReturnDto {
  @IsInt() @Min(1) customerId!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CanLineDto)
  items!: CanLineDto[];
}
export class DriverDayQuery {
  @Type(() => Number) @IsInt() @Min(1) driverId!: number;
  @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
}

export class CanReturnQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) collectorId?: number;
  @IsOptional() @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}
