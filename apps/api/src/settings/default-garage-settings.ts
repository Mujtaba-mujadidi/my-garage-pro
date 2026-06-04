import type { PrismaClient } from "@prisma/client";

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Parts purchase",
  "Subcontractor",
  "Utilities",
  "Rent",
  "Marketing",
] as const;

export const DEFAULT_VAT_RATES = [
  { label: "Standard VAT 20%", value: "20" },
  { label: "Reduced VAT 5%", value: "5" },
  { label: "Zero rated", value: "0" },
] as const;

type SettingsDb = Pick<PrismaClient, "settingOption">;

/** Idempotent: seeds default expense categories and VAT rates when missing. */
export async function ensureDefaultGarageSettings(
  db: SettingsDb,
  garageAccountId: string,
): Promise<void> {
  const expenseCount = await db.settingOption.count({
    where: { garageAccountId, optionType: "expense_category", deletedAt: null },
  });
  if (expenseCount === 0) {
    await db.settingOption.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((label, i) => ({
        garageAccountId,
        optionType: "expense_category",
        label,
        value: label.toLowerCase().replace(/\s+/g, "_"),
        sortOrder: i,
      })),
    });
  }

  const vatCount = await db.settingOption.count({
    where: { garageAccountId, optionType: "vat_rate", deletedAt: null },
  });
  if (vatCount === 0) {
    await db.settingOption.createMany({
      data: DEFAULT_VAT_RATES.map((row, i) => ({
        garageAccountId,
        optionType: "vat_rate",
        label: row.label,
        value: row.value,
        sortOrder: i,
      })),
    });
  }
}
