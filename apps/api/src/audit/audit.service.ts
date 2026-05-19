import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type AuditParams = {
  action: string;
  garageAccountId?: string | null;
  userId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditParams) {
    return this.prisma.auditLog.create({
      data: {
        action: params.action,
        garageAccountId: params.garageAccountId ?? null,
        userId: params.userId ?? null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        metadata: params.metadata ?? undefined,
      },
    });
  }
}
