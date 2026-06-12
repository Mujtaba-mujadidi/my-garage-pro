import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  JobPartUsageStatus,
  LedgerEntryDirection,
  LedgerEntryStatus,
  Prisma,
  SupplierStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import {
  toSupplierPartOrderDto,
  toSupplierPurchaseDto,
} from "./supplier-activity.mapper";
import { toSupplierDto } from "./suppliers.mapper";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private garageId(user: RequestUser): string {
    if (!user.garageAccountId) throw new ForbiddenException("No garage context");
    if (!user.enabledModules.includes("suppliers")) {
      throw new ForbiddenException("Suppliers module is not enabled");
    }
    return user.garageAccountId;
  }

  async list(user: RequestUser, q?: string, includeInactive = false) {
    const garageAccountId = this.garageId(user);
    const search = q?.trim();

    const where: Prisma.SupplierWhereInput = {
      garageAccountId,
      deletedAt: null,
      ...(includeInactive ? {} : { status: SupplierStatus.ACTIVE }),
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { vatNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const rows = await this.prisma.supplier.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: 200,
    });

    return rows.map(toSupplierDto);
  }

  private async assertSupplier(garageAccountId: string, id: string) {
    const row = await this.prisma.supplier.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async getOne(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const row = await this.assertSupplier(garageAccountId, id);
    return toSupplierDto(row);
  }

  async listPartOrders(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    await this.assertSupplier(garageAccountId, id);

    const rows = await this.prisma.jobPartUsage.findMany({
      where: {
        garageAccountId,
        supplierId: id,
        status: { not: JobPartUsageStatus.CANCELLED },
      },
      include: {
        part: { select: { partNumber: true, description: true } },
        repairJob: { select: { id: true, jobNumber: true } },
        bodyworkJob: { select: { id: true, jobNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return rows.map(toSupplierPartOrderDto);
  }

  async listPurchases(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    await this.assertSupplier(garageAccountId, id);

    const rows = await this.prisma.ledgerEntry.findMany({
      where: {
        garageAccountId,
        direction: LedgerEntryDirection.EXPENSE,
        status: { not: LedgerEntryStatus.VOID },
        OR: [
          { supplierId: id },
          { jobPartUsage: { supplierId: id } },
          { partMovement: { part: { supplierId: id } } },
          { tyreMovement: { tyre: { supplierId: id } } },
        ],
      },
      include: {
        repairJob: { select: { id: true, jobNumber: true } },
        bodyworkJob: { select: { id: true, jobNumber: true } },
        jobPartUsage: {
          select: {
            repairJob: { select: { id: true, jobNumber: true } },
            bodyworkJob: { select: { id: true, jobNumber: true } },
            part: { select: { partNumber: true, description: true } },
          },
        },
        partMovement: {
          select: {
            repairJob: { select: { id: true, jobNumber: true } },
            bodyworkJob: { select: { id: true, jobNumber: true } },
            part: { select: { partNumber: true, description: true } },
          },
        },
        tyreMovement: {
          select: {
            tyre: { select: { skuCode: true, size: true, brand: true } },
          },
        },
      },
      orderBy: [{ valueDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    return rows.map(toSupplierPurchaseDto);
  }

  async create(user: RequestUser, dto: CreateSupplierDto) {
    const garageAccountId = this.garageId(user);
    const row = await this.prisma.supplier.create({
      data: {
        garageAccountId,
        name: dto.name.trim(),
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone?.trim() || null,
        addressLine1: dto.addressLine1?.trim() || null,
        addressLine2: dto.addressLine2?.trim() || null,
        city: dto.city?.trim() || null,
        postcode: dto.postcode?.trim() || null,
        vatNumber: dto.vatNumber?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: SupplierStatus.ACTIVE,
      },
    });

    await this.audit.log({
      action: "suppliers.create",
      userId: user.id,
      garageAccountId,
      entityType: "supplier",
      entityId: row.id,
      metadata: { name: row.name },
    });

    return toSupplierDto(row);
  }

  async update(user: RequestUser, id: string, dto: UpdateSupplierDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.supplier.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException();

    const row = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        email: dto.email !== undefined ? dto.email?.trim().toLowerCase() || null : undefined,
        phone: dto.phone !== undefined ? dto.phone?.trim() || null : undefined,
        addressLine1: dto.addressLine1 !== undefined ? dto.addressLine1?.trim() || null : undefined,
        addressLine2: dto.addressLine2 !== undefined ? dto.addressLine2?.trim() || null : undefined,
        city: dto.city !== undefined ? dto.city?.trim() || null : undefined,
        postcode: dto.postcode !== undefined ? dto.postcode?.trim() || null : undefined,
        vatNumber: dto.vatNumber !== undefined ? dto.vatNumber?.trim() || null : undefined,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
      },
    });

    await this.audit.log({
      action: "suppliers.update",
      userId: user.id,
      garageAccountId,
      entityType: "supplier",
      entityId: row.id,
      metadata: { name: row.name },
    });

    return toSupplierDto(row);
  }

  async deactivate(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const row = await this.prisma.supplier.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!row) throw new NotFoundException();

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { status: SupplierStatus.INACTIVE },
    });

    await this.audit.log({
      action: "suppliers.deactivate",
      userId: user.id,
      garageAccountId,
      entityType: "supplier",
      entityId: updated.id,
      metadata: { name: updated.name },
    });

    return toSupplierDto(updated);
  }

  async activate(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const row = await this.prisma.supplier.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!row) throw new NotFoundException();

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { status: SupplierStatus.ACTIVE },
    });

    await this.audit.log({
      action: "suppliers.activate",
      userId: user.id,
      garageAccountId,
      entityType: "supplier",
      entityId: updated.id,
      metadata: { name: updated.name },
    });

    return toSupplierDto(updated);
  }
}

