import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BillingCycle, CustomerType, Prisma, UserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";
import { customerDisplayName, normalizeRegistration, toCustomerDto } from "./customers.mapper";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private garageId(user: RequestUser): string {
    if (!user.garageAccountId) throw new ForbiddenException("No garage context");
    if (!user.enabledModules.includes("customers")) {
      throw new ForbiddenException("Customers module is not enabled");
    }
    return user.garageAccountId;
  }

  private include = {
    accountTerms: true,
    vehicles: { where: { deletedAt: null }, orderBy: { registration: "asc" as const } },
  };

  async list(user: RequestUser, q?: string, includeDeleted = false) {
    const garageAccountId = this.garageId(user);
    const search = q?.trim();

    const where: Prisma.CustomerWhereInput = {
      garageAccountId,
      ...(includeDeleted ? {} : { deletedAt: null }),
    };

    if (search) {
      const reg = normalizeRegistration(search);
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        {
          vehicles: {
            some: {
              deletedAt: null,
              registration: { contains: reg, mode: "insensitive" },
            },
          },
        },
      ];
    }

    const rows = await this.prisma.customer.findMany({
      where,
      include: this.include,
      orderBy: [{ companyName: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      take: 100,
    });

    return rows.map(toCustomerDto);
  }

  async getOne(user: RequestUser, id: string, includeDeleted = false) {
    const garageAccountId = this.garageId(user);
    const row = await this.prisma.customer.findFirst({
      where: {
        id,
        garageAccountId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include: this.include,
    });
    if (!row) throw new NotFoundException();
    return toCustomerDto(row);
  }

  async create(user: RequestUser, dto: CreateCustomerDto) {
    const garageAccountId = this.garageId(user);
    this.validateCustomerDto(dto);

    const row = await this.prisma.customer.create({
      data: {
        garageAccountId,
        type: dto.type,
        firstName: dto.firstName?.trim() || null,
        lastName: dto.lastName?.trim() || null,
        companyName: dto.companyName?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone?.trim() || null,
        addressLine1: dto.addressLine1?.trim() || null,
        addressLine2: dto.addressLine2?.trim() || null,
        city: dto.city?.trim() || null,
        postcode: dto.postcode?.trim() || null,
        notes: dto.notes?.trim() || null,
        isAccountCustomer: dto.isAccountCustomer ?? false,
        accountTerms:
          dto.isAccountCustomer && dto.accountTerms
            ? {
                create: {
                  paymentTermsDays: dto.accountTerms.paymentTermsDays ?? 30,
                  creditLimit: dto.accountTerms.creditLimit
                    ? new Prisma.Decimal(dto.accountTerms.creditLimit)
                    : null,
                  billingCycle: dto.accountTerms.billingCycle ?? BillingCycle.PER_JOB,
                  statementDay: dto.accountTerms.statementDay ?? null,
                },
              }
            : undefined,
        vehicles: dto.vehicles?.length
          ? {
              create: dto.vehicles.map((v) => ({
                registration: normalizeRegistration(v.registration),
                make: v.make?.trim() || null,
                model: v.model?.trim() || null,
                colour: v.colour?.trim() || null,
                year: v.year ?? null,
                notes: v.notes?.trim() || null,
              })),
            }
          : undefined,
      },
      include: this.include,
    });

    await this.audit.log({
      action: "customers.create",
      userId: user.id,
      garageAccountId,
      entityType: "customer",
      entityId: row.id,
      metadata: { displayName: customerDisplayName(row), type: row.type },
    });

    return toCustomerDto(row);
  }

  async update(user: RequestUser, id: string, dto: UpdateCustomerDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.customer.findFirst({
      where: { id, garageAccountId, deletedAt: null },
      include: { accountTerms: true },
    });
    if (!existing) throw new NotFoundException();

    if (dto.type) this.validateCustomerDto({ ...dto, type: dto.type } as CreateCustomerDto);

    const isAccount = dto.isAccountCustomer ?? existing.isAccountCustomer;

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: {
          type: dto.type,
          firstName: dto.firstName !== undefined ? dto.firstName?.trim() || null : undefined,
          lastName: dto.lastName !== undefined ? dto.lastName?.trim() || null : undefined,
          companyName:
            dto.companyName !== undefined ? dto.companyName?.trim() || null : undefined,
          email: dto.email !== undefined ? dto.email?.trim().toLowerCase() || null : undefined,
          phone: dto.phone !== undefined ? dto.phone?.trim() || null : undefined,
          addressLine1:
            dto.addressLine1 !== undefined ? dto.addressLine1?.trim() || null : undefined,
          addressLine2:
            dto.addressLine2 !== undefined ? dto.addressLine2?.trim() || null : undefined,
          city: dto.city !== undefined ? dto.city?.trim() || null : undefined,
          postcode: dto.postcode !== undefined ? dto.postcode?.trim() || null : undefined,
          notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
          isAccountCustomer: dto.isAccountCustomer,
        },
      });

      if (isAccount && dto.accountTerms) {
        await tx.customerAccountTerms.upsert({
          where: { customerId: id },
          create: {
            customerId: id,
            paymentTermsDays: dto.accountTerms.paymentTermsDays ?? 30,
            creditLimit: dto.accountTerms.creditLimit
              ? new Prisma.Decimal(dto.accountTerms.creditLimit)
              : null,
            billingCycle: dto.accountTerms.billingCycle ?? BillingCycle.PER_JOB,
            statementDay: dto.accountTerms.statementDay ?? null,
          },
          update: {
            paymentTermsDays: dto.accountTerms.paymentTermsDays,
            creditLimit: dto.accountTerms.creditLimit
              ? new Prisma.Decimal(dto.accountTerms.creditLimit)
              : null,
            billingCycle: dto.accountTerms.billingCycle,
            statementDay: dto.accountTerms.statementDay,
          },
        });
      } else if (dto.isAccountCustomer === false && existing.accountTerms) {
        await tx.customerAccountTerms.delete({ where: { customerId: id } });
      }
    });

    await this.audit.log({
      action: "customers.update",
      userId: user.id,
      garageAccountId,
      entityType: "customer",
      entityId: id,
    });

    return this.getOne(user, id);
  }

  async softDelete(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.customer.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException();

    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id },
    });

    await this.audit.log({
      action: "customers.delete",
      userId: user.id,
      garageAccountId,
      entityType: "customer",
      entityId: id,
    });

    return { ok: true };
  }

  async restore(user: RequestUser, id: string) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.MANAGER) {
      throw new ForbiddenException("Only owner or manager can restore customers");
    }
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.customer.findFirst({
      where: { id, garageAccountId, deletedAt: { not: null } },
    });
    if (!existing) throw new NotFoundException();

    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: null, deletedBy: null },
    });

    await this.audit.log({
      action: "customers.restore",
      userId: user.id,
      garageAccountId,
      entityType: "customer",
      entityId: id,
    });

    return this.getOne(user, id);
  }

  async addVehicle(
    user: RequestUser,
    customerId: string,
    vehicle: { registration: string; make?: string; model?: string; colour?: string; year?: number; notes?: string },
  ) {
    await this.getOne(user, customerId);
    const row = await this.prisma.customerVehicle.create({
      data: {
        customerId,
        registration: normalizeRegistration(vehicle.registration),
        make: vehicle.make?.trim() || null,
        model: vehicle.model?.trim() || null,
        colour: vehicle.colour?.trim() || null,
        year: vehicle.year ?? null,
        notes: vehicle.notes?.trim() || null,
      },
    });
    return row;
  }

  private validateCustomerDto(dto: CreateCustomerDto) {
    if (dto.type === CustomerType.INDIVIDUAL) {
      if (!dto.firstName?.trim() && !dto.lastName?.trim()) {
        throw new BadRequestException("Individual customers need a first or last name");
      }
    }
    if (dto.type === CustomerType.BUSINESS) {
      if (!dto.companyName?.trim()) {
        throw new BadRequestException("Business customers need a company name");
      }
    }
    if (dto.isAccountCustomer && !dto.accountTerms) {
      throw new BadRequestException("Account customers need payment terms");
    }
  }
}
