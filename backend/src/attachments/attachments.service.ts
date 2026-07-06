import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { RequestContext } from "../common/types/request-context.type";
import { toAuditJson } from "../common/utils/audit-json.util";
import { getPagination, toPaginatedResult } from "../common/utils/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import { AttachmentQueryDto, CreateAttachmentDto } from "./dto/attachment.dto";

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async list(query: AttachmentQueryDto) {
    const { limit, page, skip, take } = getPagination(query);
    const where: Prisma.AttachmentWhereInput = {
      ownerId: query.ownerId,
      ownerType: query.ownerType,
      status: { not: "DELETED" }
    };
    if (query.search) {
      where.fileName = { contains: query.search };
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.attachment.findMany({
        include: { uploadedBy: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where
      }),
      this.prisma.attachment.count({ where })
    ]);
    return toPaginatedResult(data, total, page, limit);
  }

  async create(dto: CreateAttachmentDto, context: RequestContext) {
    const attachment = await this.prisma.attachment.create({
      data: {
        checksum: dto.checksum,
        fileName: dto.fileName.trim(),
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        ownerId: dto.ownerId,
        ownerType: dto.ownerType,
        storagePath: dto.storagePath,
        uploadedById: context.actor.id
      }
    });
    await this.auditService.record({
      action: "ATTACHMENT_CREATED",
      actorUserId: context.actor.id,
      entityId: attachment.id,
      entityType: "attachment",
      ipAddress: context.ipAddress,
      newValues: toAuditJson(attachment),
      userAgent: context.userAgent
    });
    return attachment;
  }

  async delete(id: number, context: RequestContext) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, status: { not: "DELETED" } }
    });
    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }
    const deletedAttachment = await this.prisma.attachment.update({
      data: {
        deletedAt: new Date(),
        deletedById: context.actor.id,
        status: "DELETED"
      },
      where: { id }
    });
    await this.auditService.record({
      action: "ATTACHMENT_SOFT_DELETED",
      actorUserId: context.actor.id,
      entityId: id,
      entityType: "attachment",
      ipAddress: context.ipAddress,
      oldValues: toAuditJson(attachment),
      userAgent: context.userAgent
    });
    return deletedAttachment;
  }
}
