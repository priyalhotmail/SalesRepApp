import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  AdjustInventoryDto,
  CreateStockReservationDto,
  InventoryMovementQueryDto,
  InventoryStockQueryDto,
  ReleaseStockReservationDto,
  StockReservationQueryDto
} from "./dto/inventory.dto";

type StockWithAvailability = {
  availableQuantity: number;
  lowStock: boolean;
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listStocks(query: InventoryStockQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.InventoryStockWhereInput = {
      productId: query.productId,
      warehouseId: query.warehouseId
    };

    if (query.search) {
      where.OR = [
        { product: { code: { contains: query.search } } },
        { product: { name: { contains: query.search } } },
        { warehouse: { code: { contains: query.search } } },
        { warehouse: { name: { contains: query.search } } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryStock.findMany({
        include: { product: true, warehouse: true },
        orderBy: [{ warehouseId: "asc" }, { productId: "asc" }],
        skip,
        take,
        where
      }),
      this.prisma.inventoryStock.count({ where })
    ]);

    return toPaginatedResult(
      data.map((stock) => ({
        ...stock,
        ...this.getAvailability(stock)
      })),
      total,
      page,
      limit
    );
  }

  async listMovements(query: InventoryMovementQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.InventoryMovementWhereInput = {
      productId: query.productId,
      referenceId: query.referenceId,
      referenceType: query.referenceType,
      warehouseId: query.warehouseId
    };

    if (query.search) {
      where.OR = [
        { notes: { contains: query.search } },
        { product: { code: { contains: query.search } } },
        { product: { name: { contains: query.search } } },
        { warehouse: { code: { contains: query.search } } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        include: { product: true, warehouse: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.inventoryMovement.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async listReservations(query: StockReservationQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.StockReservationWhereInput = {
      orderId: query.orderId,
      productId: query.productId,
      status: query.status,
      warehouseId: query.warehouseId
    };

    if (query.search) {
      where.OR = [
        { notes: { contains: query.search } },
        { product: { code: { contains: query.search } } },
        { product: { name: { contains: query.search } } },
        { warehouse: { code: { contains: query.search } } }
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.stockReservation.findMany({
        include: { order: true, product: true, warehouse: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.stockReservation.count({ where })
    ]);

    return toPaginatedResult(data, total, page, limit);
  }

  async adjustStock(dto: AdjustInventoryDto, context: RequestContext) {
    await this.ensureWarehouse(dto.warehouseId);
    await this.ensureProduct(dto.productId);

    const result = await this.prisma.$transaction(async (tx) => {
      const stock = await this.getOrCreateStock(
        tx,
        dto.warehouseId,
        dto.productId
      );
      const nextOnHand =
        Number(stock.onHandQuantity) + Number(dto.quantityChange);
      const reservedQuantity = Number(stock.reservedQuantity);

      if (nextOnHand < 0) {
        throw new BadRequestException("Stock on hand cannot be negative");
      }
      if (nextOnHand < reservedQuantity) {
        throw new BadRequestException(
          "Stock on hand cannot be below reserved quantity"
        );
      }

      const updatedStock = await tx.inventoryStock.update({
        data: {
          lowStockThreshold: dto.lowStockThreshold,
          onHandQuantity: nextOnHand
        },
        include: { product: true, warehouse: true },
        where: { id: stock.id }
      });

      await tx.inventoryMovement.create({
        data: {
          balanceAfter: nextOnHand,
          createdById: context.actor.id,
          movementType: "STOCK_ADJUSTMENT",
          notes: dto.notes,
          productId: dto.productId,
          quantity: dto.quantityChange,
          referenceType: "manual_adjustment",
          warehouseId: dto.warehouseId
        }
      });

      return {
        ...updatedStock,
        ...this.getAvailability(updatedStock)
      };
    });

    await this.auditService.record({
      action: "INVENTORY_STOCK_ADJUSTED",
      actorUserId: context.actor.id,
      entityId: result.id,
      entityType: "inventory_stock",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(dto),
      userAgent: context.userAgent
    });

    return result;
  }

  async createReservation(
    dto: CreateStockReservationDto,
    context: RequestContext
  ) {
    await this.ensureWarehouse(dto.warehouseId);
    await this.ensureProduct(dto.productId);
    if (dto.orderId) {
      await this.ensureOrder(dto.orderId);
    }

    const reservation = await this.prisma.$transaction(async (tx) => {
      const stock = await this.getOrCreateStock(
        tx,
        dto.warehouseId,
        dto.productId
      );
      const available =
        Number(stock.onHandQuantity) - Number(stock.reservedQuantity);

      if (Number(dto.quantity) > available) {
        throw new BadRequestException("Insufficient available stock");
      }

      const nextReserved =
        Number(stock.reservedQuantity) + Number(dto.quantity);
      const updatedStock = await tx.inventoryStock.update({
        data: { reservedQuantity: nextReserved },
        where: { id: stock.id }
      });

      const createdReservation = await tx.stockReservation.create({
        data: {
          createdById: context.actor.id,
          notes: dto.notes,
          orderId: dto.orderId,
          productId: dto.productId,
          quantity: dto.quantity,
          warehouseId: dto.warehouseId
        },
        include: { order: true, product: true, warehouse: true }
      });

      await tx.inventoryMovement.create({
        data: {
          balanceAfter: Number(updatedStock.onHandQuantity),
          createdById: context.actor.id,
          movementType: "RESERVATION",
          notes: dto.notes,
          productId: dto.productId,
          quantity: dto.quantity,
          referenceId: String(createdReservation.id),
          referenceType: "stock_reservation",
          warehouseId: dto.warehouseId
        }
      });

      return createdReservation;
    });

    await this.auditService.record({
      action: "STOCK_RESERVED",
      actorUserId: context.actor.id,
      entityId: reservation.id,
      entityType: "stock_reservation",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(reservation),
      userAgent: context.userAgent
    });

    return reservation;
  }

  async releaseReservation(
    id: number,
    dto: ReleaseStockReservationDto,
    context: RequestContext
  ) {
    const reservation = await this.prisma.$transaction(async (tx) => {
      const currentReservation = await tx.stockReservation.findFirst({
        where: { id, status: "ACTIVE" }
      });
      if (!currentReservation) {
        throw new NotFoundException("Active stock reservation not found");
      }

      const stock = await this.getOrCreateStock(
        tx,
        currentReservation.warehouseId,
        currentReservation.productId
      );
      const nextReserved = Math.max(
        Number(stock.reservedQuantity) - Number(currentReservation.quantity),
        0
      );

      const updatedStock = await tx.inventoryStock.update({
        data: { reservedQuantity: nextReserved },
        where: { id: stock.id }
      });

      const releasedReservation = await tx.stockReservation.update({
        data: {
          notes: dto.notes ?? currentReservation.notes,
          releasedAt: new Date(),
          releasedById: context.actor.id,
          status: "RELEASED"
        },
        include: { order: true, product: true, warehouse: true },
        where: { id }
      });

      await tx.inventoryMovement.create({
        data: {
          balanceAfter: Number(updatedStock.onHandQuantity),
          createdById: context.actor.id,
          movementType: "RESERVATION_RELEASE",
          notes: dto.notes,
          productId: currentReservation.productId,
          quantity: -Number(currentReservation.quantity),
          referenceId: String(id),
          referenceType: "stock_reservation",
          warehouseId: currentReservation.warehouseId
        }
      });

      return releasedReservation;
    });

    await this.auditService.record({
      action: "STOCK_RESERVATION_RELEASED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "stock_reservation",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(reservation),
      userAgent: context.userAgent
    });

    return reservation;
  }

  private async getOrCreateStock(
    tx: Prisma.TransactionClient,
    warehouseId: number,
    productId: number
  ) {
    const existingStock = await tx.inventoryStock.findUnique({
      where: { warehouseId_productId: { productId, warehouseId } }
    });

    if (existingStock) {
      return existingStock;
    }

    return tx.inventoryStock.create({
      data: {
        productId,
        warehouseId
      }
    });
  }

  private getAvailability(stock: {
    lowStockThreshold: Prisma.Decimal | number;
    onHandQuantity: Prisma.Decimal | number;
    reservedQuantity: Prisma.Decimal | number;
  }): StockWithAvailability {
    const availableQuantity =
      Number(stock.onHandQuantity) - Number(stock.reservedQuantity);
    return {
      availableQuantity,
      lowStock: availableQuantity <= Number(stock.lowStockThreshold)
    };
  }

  private async ensureWarehouse(warehouseId: number) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, status: { not: "DELETED" } }
    });
    if (!warehouse) {
      throw new BadRequestException("Warehouse is invalid");
    }
  }

  private async ensureProduct(productId: number) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: { not: "DELETED" } }
    });
    if (!product) {
      throw new BadRequestException("Product is invalid");
    }
  }

  private async ensureOrder(orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { deletedAt: null, id: orderId, status: { not: "CANCELLED" } }
    });
    if (!order) {
      throw new BadRequestException("Order is invalid");
    }
  }
}
