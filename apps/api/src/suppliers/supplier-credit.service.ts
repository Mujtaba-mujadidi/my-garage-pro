import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  SupplierCreditTransactionType,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/auth.types";
import { roundMoney } from "../invoices/invoice-calculations";
import { PrismaService } from "../prisma/prisma.service";
import { toSupplierCreditTransactionDto } from "./supplier-credit.mapper";

@Injectable()
export class SupplierCreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private garageId(user: RequestUser): string {
    if (!user.garageAccountId) throw new BadRequestException("No garage context");
    return user.garageAccountId;
  }

  async listTransactions(user: RequestUser, supplierId: string) {
    const garageAccountId = this.garageId(user);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, garageAccountId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException("Supplier not found");

    const rows = await this.prisma.supplierCreditTransaction.findMany({
      where: { supplierId, garageAccountId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map(toSupplierCreditTransactionDto);
  }

  async addRefundCredit(
    user: RequestUser,
    params: {
      supplierId: string;
      amountGross: number;
      jobPartUsageId?: string;
      notes?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const amount = Number(roundMoney(params.amountGross));
    if (amount <= 0) {
      throw new BadRequestException("Refund credit amount must be greater than zero");
    }
    return this.adjustCredit(
      user,
      {
        supplierId: params.supplierId,
        amount: new Prisma.Decimal(amount),
        type: SupplierCreditTransactionType.REFUND_CREDIT,
        jobPartUsageId: params.jobPartUsageId,
        notes: params.notes,
      },
      tx,
    );
  }

  async applyCredit(
    user: RequestUser,
    params: {
      supplierId: string;
      amountGross: number;
      jobPartUsageId?: string;
      ledgerEntryId?: string;
      notes?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const amount = Number(roundMoney(params.amountGross));
    if (amount <= 0) {
      throw new BadRequestException("Credit amount must be greater than zero");
    }
    return this.adjustCredit(
      user,
      {
        supplierId: params.supplierId,
        amount: new Prisma.Decimal(-amount),
        type: SupplierCreditTransactionType.APPLIED_PAYMENT,
        jobPartUsageId: params.jobPartUsageId,
        ledgerEntryId: params.ledgerEntryId,
        notes: params.notes,
      },
      tx,
    );
  }

  private async adjustCredit(
    user: RequestUser,
    params: {
      supplierId: string;
      amount: Prisma.Decimal;
      type: SupplierCreditTransactionType;
      jobPartUsageId?: string;
      ledgerEntryId?: string;
      notes?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const garageAccountId = this.garageId(user);
    const db = tx ?? this.prisma;

    const supplier = await db.supplier.findFirst({
      where: { id: params.supplierId, garageAccountId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException("Supplier not found");

    const delta = params.amount;
    const newBalance = supplier.creditBalance.add(delta);
    if (newBalance.lessThan(0)) {
      throw new BadRequestException(
        `Insufficient supplier credit — balance is £${Number(supplier.creditBalance).toFixed(2)}`,
      );
    }

    await db.supplier.update({
      where: { id: params.supplierId },
      data: { creditBalance: newBalance },
    });

    const row = await db.supplierCreditTransaction.create({
      data: {
        garageAccountId,
        supplierId: params.supplierId,
        type: params.type,
        amount: delta,
        balanceAfter: newBalance,
        jobPartUsageId: params.jobPartUsageId ?? null,
        ledgerEntryId: params.ledgerEntryId ?? null,
        notes: params.notes?.trim() || null,
        createdById: user.id,
      },
    });

    if (!tx) {
      await this.audit.log({
        action: "suppliers.credit.adjust",
        userId: user.id,
        garageAccountId,
        entityType: "supplier",
        entityId: params.supplierId,
        metadata: {
          type: params.type,
          amount: delta.toString(),
          balanceAfter: newBalance.toString(),
        },
      });
    }

    return row;
  }
}
