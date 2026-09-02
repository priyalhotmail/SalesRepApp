import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, WarehouseTransferStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  ApproveWarehouseTransferDto,
  CreateWarehouseTransferDto,
  ReceiveWarehouseTransferDto,
  WarehouseTransferNoteDto,
  WarehouseTransferQueryDto
} from "./dto/warehouse-transfer.dto";

const transferInclude = {
  fromWarehouse: true,
  history: true,
  items: { include: { product: true } },
  requestedBy: true,
  toWarehouse: true
} satisfies Prisma.WarehouseTransferInclude;

@Injectable()
export class WarehouseTransfersService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async list(query: WarehouseTransferQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.WarehouseTransferWhereInput = {
      fromWarehouseId: query.fromWarehouseId,
      status: query.status,
      toWarehouseId: query.toWarehouseId
    };
    if (query.search) {
      where.OR = [
        { transferNumber: { contains: query.search } },
        { fromWarehouse: { code: { contains: query.search } } },
        { toWarehouse: { code: { contains: query.search } } }
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.warehouseTransfer.findMany({
        include: transferInclude,
        orderBy: { requestedAt: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.warehouseTransfer.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async findById(id: number) {
    const transfer = await this.prisma.warehouseTransfer.findUnique({
      include: transferInclude,
      where: { id }
    });
    if (!transfer) {
      throw new NotFoundException("Warehouse transfer not found");
    }
    return transfer;
  }

  async create(dto: CreateWarehouseTransferDto, context: RequestContext) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException("Transfer warehouses must be different");
    }
    await this.ensureWarehouse(dto.fromWarehouseId);
    await this.ensureWarehouse(dto.toWarehouseId);
    await this.ensureProducts(dto.items.map((item) => item.productId));
    const transferNumber = await this.generateTransferNumber();

    const transfer = await this.prisma.$transaction(async (tx) => {
      const createdTransfer = await tx.warehouseTransfer.create({
        data: {
          fromWarehouseId: dto.fromWarehouseId,
          items: {
            create: dto.items.map((item) => ({
              notes: item.notes,
              productId: item.productId,
              requestedQuantity: item.requestedQuantity
            }))
          },
          notes: dto.notes,
          requestedById: context.actor.id,
          toWarehouseId: dto.toWarehouseId,
          transferNumber
        }
      });
      await this.addHistory(tx, createdTransfer.id, null, "REQUESTED", dto.notes, context);
      return tx.warehouseTransfer.findUnique({
        include: transferInclude,
        where: { id: createdTransfer.id }
      });
    });
    if (!transfer) {
      throw new NotFoundException("Created warehouse transfer could not be loaded");
    }

    await this.recordAudit("WAREHOUSE_TRANSFER_REQUESTED", transfer, context);
    return transfer;
  }

  async approve(
    id: number,
    dto: ApproveWarehouseTransferDto,
    context: RequestContext
  ) {
    const transfer = await this.findById(id);
    if (transfer.status !== "REQUESTED") {
      throw new BadRequestException("Only requested transfers can be approved");
    }
    const approvals = new Map(
      dto.items?.map((item) => [item.productId, item.approvedQuantity]) ?? []
    );

    const approvedTransfer = await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const approvedQuantity = approvals.get(item.productId) ?? Number(item.requestedQuantity);
        if (approvedQuantity > Number(item.requestedQuantity)) {
          throw new BadRequestException("Approved quantity cannot exceed requested quantity");
        }
        await tx.warehouseTransferItem.update({
          data: { approvedQuantity },
          where: { id: item.id }
        });
      }
      await this.addHistory(tx, id, transfer.status, "APPROVED", dto.notes, context);
      return tx.warehouseTransfer.update({
        data: {
          approvedAt: new Date(),
          approvedById: context.actor.id,
          notes: dto.notes ?? transfer.notes,
          status: "APPROVED"
        },
        include: transferInclude,
        where: { id }
      });
    });
    await this.recordAudit("WAREHOUSE_TRANSFER_APPROVED", approvedTransfer, context, transfer);
    return approvedTransfer;
  }

  async reject(id: number, dto: WarehouseTransferNoteDto, context: RequestContext) {
    return this.terminalStatus(id, "REJECTED", dto, context);
  }

  async cancel(id: number, dto: WarehouseTransferNoteDto, context: RequestContext) {
    return this.terminalStatus(id, "CANCELLED", dto, context);
  }

  async dispatch(id: number, dto: WarehouseTransferNoteDto, context: RequestContext) {
    const transfer = await this.findById(id);
    if (transfer.status !== "APPROVED") {
      throw new BadRequestException("Only approved transfers can be dispatched");
    }

    const dispatchedTransfer = await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const quantity = Number(item.approvedQuantity);
        if (quantity <= 0) {
          continue;
        }
        const stock = await this.getOrCreateStock(tx, transfer.fromWarehouseId, item.productId);
        if (Number(stock.onHandQuantity) - Number(stock.reservedQuantity) < quantity) {
          throw new BadRequestException(`Insufficient stock for product ${item.productId}`);
        }
        const nextOnHand = Number(stock.onHandQuantity) - quantity;
        const updatedStock = await tx.inventoryStock.update({
          data: { onHandQuantity: nextOnHand },
          where: { id: stock.id }
        });
        await tx.inventoryMovement.create({
          data: {
            balanceAfter: Number(updatedStock.onHandQuantity),
            createdById: context.actor.id,
            movementType: "TRANSFER_DISPATCH",
            notes: `Transfer ${transfer.transferNumber} dispatched`,
            productId: item.productId,
            quantity: -quantity,
            referenceId: String(transfer.id),
            referenceType: "warehouse_transfer",
            warehouseId: transfer.fromWarehouseId
          }
        });
        await tx.warehouseTransferItem.update({
          data: { dispatchedQuantity: quantity },
          where: { id: item.id }
        });
      }
      await this.addHistory(tx, id, transfer.status, "IN_TRANSIT", dto.notes, context);
      return tx.warehouseTransfer.update({
        data: {
          dispatchedAt: new Date(),
          dispatchedById: context.actor.id,
          notes: dto.notes ?? transfer.notes,
          status: "IN_TRANSIT"
        },
        include: transferInclude,
        where: { id }
      });
    });
    await this.recordAudit("WAREHOUSE_TRANSFER_DISPATCHED", dispatchedTransfer, context, transfer);
    return dispatchedTransfer;
  }

  async receive(
    id: number,
    dto: ReceiveWarehouseTransferDto,
    context: RequestContext
  ) {
    const transfer = await this.findById(id);
    await this.ensureReceiveAccess(transfer.toWarehouseId, context.actor);
    if (transfer.status !== "IN_TRANSIT") {
      throw new BadRequestException("Only in-transit transfers can be received");
    }
    const receivedByProduct = new Map(
      dto.items?.map((item) => [item.productId, item.approvedQuantity]) ?? []
    );

    const receivedTransfer = await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const quantity = receivedByProduct.get(item.productId) ?? Number(item.dispatchedQuantity);
        if (quantity > Number(item.dispatchedQuantity)) {
          throw new BadRequestException("Received quantity cannot exceed dispatched quantity");
        }
        const stock = await this.getOrCreateStock(tx, transfer.toWarehouseId, item.productId);
        const nextOnHand = Number(stock.onHandQuantity) + quantity;
        const updatedStock = await tx.inventoryStock.update({
          data: { onHandQuantity: nextOnHand },
          where: { id: stock.id }
        });
        await tx.inventoryMovement.create({
          data: {
            balanceAfter: Number(updatedStock.onHandQuantity),
            createdById: context.actor.id,
            movementType: "TRANSFER_RECEIPT",
            notes: `Transfer ${transfer.transferNumber} received`,
            productId: item.productId,
            quantity,
            referenceId: String(transfer.id),
            referenceType: "warehouse_transfer",
            warehouseId: transfer.toWarehouseId
          }
        });
        await tx.warehouseTransferItem.update({
          data: { receivedQuantity: quantity },
          where: { id: item.id }
        });
      }
      await this.addHistory(tx, id, transfer.status, "RECEIVED", dto.notes, context);
      return tx.warehouseTransfer.update({
        data: {
          notes: dto.notes ?? transfer.notes,
          receivedAt: new Date(),
          receivedById: context.actor.id,
          status: "RECEIVED"
        },
        include: transferInclude,
        where: { id }
      });
    });
    await this.recordAudit("WAREHOUSE_TRANSFER_RECEIVED", receivedTransfer, context, transfer);
    return receivedTransfer;
  }

  private async terminalStatus(
    id: number,
    status: "REJECTED" | "CANCELLED",
    dto: WarehouseTransferNoteDto,
    context: RequestContext
  ) {
    const transfer = await this.findById(id);
    if (!["REQUESTED", "APPROVED"].includes(transfer.status)) {
      throw new BadRequestException("Transfer cannot be changed to this status");
    }
    const updatedTransfer = await this.prisma.$transaction(async (tx) => {
      await this.addHistory(tx, id, transfer.status, status, dto.notes, context);
      return tx.warehouseTransfer.update({
        data: { notes: dto.notes ?? transfer.notes, status },
        include: transferInclude,
        where: { id }
      });
    });
    await this.recordAudit(`WAREHOUSE_TRANSFER_${status}`, updatedTransfer, context, transfer);
    return updatedTransfer;
  }

  private async ensureReceiveAccess(warehouseId: number, actor: RequestContext["actor"]) {
    if (actor.roles.includes("SUPER_ADMIN")) {
      return;
    }
    const employee = await this.prisma.employee.findFirst({
      select: { id: true },
      where: {
        deletedAt: null,
        status: "ACTIVE",
        userId: actor.id,
        warehouseId
      }
    });
    if (!employee) {
      throw new ForbiddenException("Only an authorized user assigned to the receiving warehouse can receive this transfer");
    }
  }

  private async addHistory(
    tx: Prisma.TransactionClient,
    transferId: number,
    oldStatus: WarehouseTransferStatus | null,
    newStatus: WarehouseTransferStatus,
    notes: string | undefined,
    context: RequestContext
  ) {
    await tx.warehouseTransferStatusHistory.create({
      data: {
        changedById: context.actor.id,
        newStatus,
        notes,
        oldStatus,
        warehouseTransferId: transferId
      }
    });
  }

  private async recordAudit(
    action: string,
    transfer: unknown,
    context: RequestContext,
    oldValues?: unknown
  ) {
    await this.auditService.record({
      action,
      actorUserId: context.actor.id,
      entityId:
        transfer && typeof transfer === "object" && "id" in transfer
          ? Number(transfer.id)
          : undefined,
      entityType: "warehouse_transfer",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(transfer),
      oldValues: oldValues ? toAuditJson(oldValues) : undefined,
      userAgent: context.userAgent
    });
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
    return tx.inventoryStock.create({ data: { productId, warehouseId } });
  }

  private async ensureWarehouse(warehouseId: number) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, status: { not: "DELETED" } }
    });
    if (!warehouse) {
      throw new BadRequestException("Warehouse is invalid");
    }
  }

  private async ensureProducts(productIds: number[]) {
    const uniqueIds = [...new Set(productIds)];
    const count = await this.prisma.product.count({
      where: { id: { in: uniqueIds }, status: { not: "DELETED" } }
    });
    if (count !== uniqueIds.length) {
      throw new BadRequestException("One or more products are invalid");
    }
  }

  private async generateTransferNumber() {
    const count = await this.prisma.warehouseTransfer.count();
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `WTR-${datePart}-${String(count + 1).padStart(5, "0")}`;
  }
}
