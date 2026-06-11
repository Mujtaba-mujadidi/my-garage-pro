import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient, UserRole } from "@prisma/client";

loadEnv({ path: resolve(__dirname, "../.env") });
import * as argon2 from "argon2";
import {
  DEFAULT_GARAGE_ROLES,
  GARAGE_PERMISSIONS,
  MODULE_KEYS,
  type ModuleKey,
} from "@mygaragepro/shared";
import { ensureDefaultGarageSettings } from "../src/settings/default-garage-settings";

const prisma = new PrismaClient();

async function hashPassword(password: string) {
  return argon2.hash(password);
}

/** Create missing module rows only — never overwrite enabled toggles set in Super Admin. */
async function ensureGarageModuleRows(garageAccountId: string, enabledOnCreate: ModuleKey[]) {
  for (const moduleKey of MODULE_KEYS) {
    await prisma.garageAccountModule.upsert({
      where: {
        garageAccountId_moduleKey: { garageAccountId, moduleKey },
      },
      create: {
        garageAccountId,
        moduleKey,
        enabled: enabledOnCreate.includes(moduleKey),
      },
      update: {},
    });
  }
}

/** Demo garage: local UAT expects every module on; re-seed restores without touching other garages. */
async function enableAllModulesForDemoGarage(garageAccountId: string) {
  await ensureGarageModuleRows(garageAccountId, MODULE_KEYS as unknown as ModuleKey[]);
  await prisma.garageAccountModule.updateMany({
    where: { garageAccountId },
    data: { enabled: true },
  });
}

async function seedGarageRoles(garageAccountId: string) {
  for (let i = 0; i < DEFAULT_GARAGE_ROLES.length; i++) {
    const template = DEFAULT_GARAGE_ROLES[i];
    const role = await prisma.garageRole.upsert({
      where: {
        garageAccountId_slug: { garageAccountId, slug: template.slug },
      },
      create: {
        garageAccountId,
        name: template.name,
        slug: template.slug,
        isDefault: true,
        sortOrder: i,
      },
      update: { name: template.name },
    });

    for (const permission of GARAGE_PERMISSIONS) {
      await prisma.garageRolePermission.upsert({
        where: { garageRoleId_permission: { garageRoleId: role.id, permission } },
        create: {
          garageRoleId: role.id,
          permission,
          granted: template.permissions.includes(permission),
        },
        update: { granted: template.permissions.includes(permission) },
      });
    }
  }
}

async function main() {
  const superEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@demo.garage";
  const superPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "demo";

  async function upsertSuperAdmin(email: string, password: string, displayName: string) {
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        displayName,
        role: UserRole.SUPER_ADMIN,
        garageAccountId: null,
        garageRoleId: null,
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
      },
      update: {
        displayName,
        role: UserRole.SUPER_ADMIN,
        garageAccountId: null,
        garageRoleId: null,
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
        status: "ACTIVE",
      },
    });
  }

  await upsertSuperAdmin(superEmail, superPassword, "Platform Super Admin");
  // Primary demo super admin (always seeded, even when SEED_SUPER_ADMIN_* overrides above)
  await upsertSuperAdmin("admin@demo.garage", "demo", "Demo Super Admin");

  const demoGarage = await prisma.garageAccount.upsert({
    where: { slug: "demo-garage" },
    create: {
      name: "Demo Garage Ltd",
      slug: "demo-garage",
      directorOwnerName: "James Owner",
      address: "1 Demo Street, London, SW1A 1AA",
      contactNumber: "020 7946 0958",
      phoneNumber: "07700 900123",
      vatNumber: "GB123456789",
      status: "ACTIVE",
    },
    update: {
      name: "Demo Garage Ltd",
      directorOwnerName: "James Owner",
      address: "1 Demo Street, London, SW1A 1AA",
      contactNumber: "020 7946 0958",
      phoneNumber: "07700 900123",
      vatNumber: "GB123456789",
      status: "ACTIVE",
    },
  });

  await enableAllModulesForDemoGarage(demoGarage.id);
  await seedGarageRoles(demoGarage.id);

  const managerRole = await prisma.garageRole.findUniqueOrThrow({
    where: { garageAccountId_slug: { garageAccountId: demoGarage.id, slug: "manager" } },
  });
  const mechanicRole = await prisma.garageRole.findUniqueOrThrow({
    where: { garageAccountId_slug: { garageAccountId: demoGarage.id, slug: "mechanic" } },
  });

  const existingSettings = await prisma.settingOption.count({
    where: { garageAccountId: demoGarage.id, deletedAt: null },
  });
  if (existingSettings === 0) {
    await ensureDefaultGarageSettings(prisma, demoGarage.id);
  }

  const demoUsers: {
    email: string;
    displayName: string;
    role: UserRole;
    garageRoleId?: string;
    password: string;
  }[] = [
    { email: "owner@demo.garage", displayName: "James Owner", role: UserRole.OWNER, password: "demo" },
    {
      email: "manager@demo.garage",
      displayName: "Sam Manager",
      role: UserRole.STAFF,
      garageRoleId: managerRole.id,
      password: "demo",
    },
    {
      email: "mechanic@demo.garage",
      displayName: "Mike Mechanic",
      role: UserRole.STAFF,
      garageRoleId: mechanicRole.id,
      password: "demo",
    },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        garageRoleId: u.garageRoleId,
        garageAccountId: demoGarage.id,
        passwordHash: await hashPassword(u.password),
        mustChangePassword: false,
      },
      update: {
        displayName: u.displayName,
        role: u.role,
        garageRoleId: u.garageRoleId,
        garageAccountId: demoGarage.id,
        passwordHash: await hashPassword(u.password),
        mustChangePassword: false,
        status: "ACTIVE",
      },
    });
  }

  // Suppliers (Phase 3)
  const demoSuppliers = [
    {
      name: "Euro Car Parts",
      email: "accounts@eurocarparts.example",
      phone: "020 7000 1111",
      vatNumber: "GB999999999",
      city: "London",
      postcode: "SW1A 1AA",
    },
    {
      name: "GSF Car Parts",
      email: "billing@gsfcarparts.example",
      phone: "020 7000 2222",
      vatNumber: null as string | null,
      city: "London",
      postcode: "E1 6AN",
    },
  ];

  for (const s of demoSuppliers) {
    const existing = await prisma.supplier.findFirst({
      where: { garageAccountId: demoGarage.id, name: s.name, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      await prisma.supplier.create({
        data: {
          garageAccountId: demoGarage.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          vatNumber: s.vatNumber,
          city: s.city,
          postcode: s.postcode,
          status: "ACTIVE",
        },
      });
    } else {
      await prisma.supplier.update({
        where: { id: existing.id },
        data: {
          email: s.email,
          phone: s.phone,
          vatNumber: s.vatNumber,
          city: s.city,
          postcode: s.postcode,
          status: "ACTIVE",
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log("  Super Admin: admin@demo.garage / demo");
  if (superEmail !== "admin@demo.garage") {
    console.log(`  Super Admin (env): ${superEmail} / (see SEED_SUPER_ADMIN_PASSWORD)`);
  }
  console.log("  Demo garage: owner@demo.garage / demo");
  console.log("               manager@demo.garage / demo");
  console.log("               mechanic@demo.garage / demo");
  console.log("  Suppliers: Euro Car Parts, GSF Car Parts");

  // Parts stock (Phase 7)
  const euroSupplier = await prisma.supplier.findFirst({
    where: { garageAccountId: demoGarage.id, name: "Euro Car Parts", deletedAt: null },
    select: { id: true },
  });

  type DemoPartSeed = {
    partNumber: string;
    description: string;
    category: string;
    quantityOnHand: number;
    minQuantity: number;
    costPriceNet: number;
    sellPriceNet: number;
    location: string;
    fitmentType: "UNIVERSAL" | "VEHICLE_SPECIFIC";
    fitments?: { make: string; model: string; yearFrom: number; yearTo?: number | null }[];
  };

  const demoParts: DemoPartSeed[] = [
    {
      partNumber: "OIL-5W30-5L",
      description: "5W-30 fully synthetic engine oil 5L",
      category: "Fluids",
      quantityOnHand: 12,
      minQuantity: 4,
      costPriceNet: 18.5,
      sellPriceNet: 32,
      location: "Shelf A1",
      fitmentType: "UNIVERSAL",
    },
    {
      partNumber: "FLT-OIL-STD",
      description: "Standard oil filter — Toyota Corolla",
      category: "Filters",
      quantityOnHand: 3,
      minQuantity: 5,
      costPriceNet: 4.2,
      sellPriceNet: 9.5,
      location: "Shelf B2",
      fitmentType: "VEHICLE_SPECIFIC",
      fitments: [{ make: "Toyota", model: "Corolla", yearFrom: 2012, yearTo: 2018 }],
    },
    {
      partNumber: "BRK-PAD-FRT",
      description: "Front brake pad set — Toyota Prius",
      category: "Brakes",
      quantityOnHand: 8,
      minQuantity: 2,
      costPriceNet: 28,
      sellPriceNet: 55,
      location: "Shelf C3",
      fitmentType: "VEHICLE_SPECIFIC",
      fitments: [{ make: "Toyota", model: "Prius", yearFrom: 2010, yearTo: 2015 }],
    },
    {
      partNumber: "SK-PRIUS-10-15",
      description: "Service kit — Toyota Prius 2010–2015",
      category: "Service kits",
      quantityOnHand: 4,
      minQuantity: 2,
      costPriceNet: 42,
      sellPriceNet: 79,
      location: "Shelf D1",
      fitmentType: "VEHICLE_SPECIFIC",
      fitments: [{ make: "Toyota", model: "Prius", yearFrom: 2010, yearTo: 2015 }],
    },
    {
      partNumber: "SK-PRIUS-16-19",
      description: "Service kit — Toyota Prius 2016–2019",
      category: "Service kits",
      quantityOnHand: 3,
      minQuantity: 2,
      costPriceNet: 48,
      sellPriceNet: 89,
      location: "Shelf D2",
      fitmentType: "VEHICLE_SPECIFIC",
      fitments: [{ make: "Toyota", model: "Prius", yearFrom: 2016, yearTo: 2019 }],
    },
  ];

  for (const p of demoParts) {
    const existing = await prisma.part.findFirst({
      where: { garageAccountId: demoGarage.id, partNumber: p.partNumber, deletedAt: null },
      select: { id: true },
    });

    const partData = {
      description: p.description,
      category: p.category,
      fitmentType: p.fitmentType,
      quantityOnHand: p.quantityOnHand,
      minQuantity: p.minQuantity,
      costPriceNet: p.costPriceNet,
      sellPriceNet: p.sellPriceNet,
      location: p.location,
      supplierId: euroSupplier?.id ?? null,
      status: "ACTIVE" as const,
    };

    let partId = existing?.id;
    if (!existing) {
      const created = await prisma.part.create({
        data: {
          garageAccountId: demoGarage.id,
          partNumber: p.partNumber,
          ...partData,
        },
      });
      partId = created.id;
    } else {
      await prisma.part.update({ where: { id: existing.id }, data: partData });
    }

    // Re-seed fitment rows so demo data stays in sync without duplicating.
    if (partId) {
      await prisma.partFitment.deleteMany({ where: { partId } });
      if (p.fitmentType === "VEHICLE_SPECIFIC" && p.fitments?.length) {
        await prisma.partFitment.createMany({
          data: p.fitments.map((f, index) => ({
            partId,
            make: f.make,
            model: f.model,
            yearFrom: f.yearFrom,
            yearTo: f.yearTo ?? null,
            sortOrder: index,
          })),
        });
      }
    }
  }

  console.log(
    "  Parts: OIL-5W30-5L (universal), FLT-OIL-STD, BRK-PAD-FRT, SK-PRIUS-10-15, SK-PRIUS-16-19",
  );

  // Tyres (Phase 8)
  type DemoTyreSeed = {
    skuCode: string;
    brand: string;
    model?: string;
    size: string;
    loadIndex?: string;
    speedRating?: string;
    condition: "NEW" | "PART_WORN";
    quantityOnHand: number;
    minQuantity: number;
    costPriceNet: number;
    sellPriceNet: number;
    tradeSellPriceNet: number;
    fittingChargeNet: number;
    location: string;
  };

  const demoTyres: DemoTyreSeed[] = [
    {
      skuCode: "20555R16MICHELIN",
      brand: "Michelin",
      model: "Primacy 4",
      size: "205/55R16",
      loadIndex: "91",
      speedRating: "V",
      condition: "NEW",
      quantityOnHand: 8,
      minQuantity: 4,
      costPriceNet: 52,
      sellPriceNet: 89,
      tradeSellPriceNet: 72,
      fittingChargeNet: 12,
      location: "Tyre rack A",
    },
    {
      skuCode: "19565R15CONTINENTAL",
      brand: "Continental",
      model: "PremiumContact 6",
      size: "195/65R15",
      loadIndex: "91",
      speedRating: "H",
      condition: "NEW",
      quantityOnHand: 6,
      minQuantity: 2,
      costPriceNet: 45,
      sellPriceNet: 75,
      tradeSellPriceNet: 62,
      fittingChargeNet: 12,
      location: "Tyre rack A",
    },
    {
      skuCode: "175/65R14-BUDGET",
      brand: "Budget",
      size: "175/65R14",
      loadIndex: "82",
      speedRating: "T",
      condition: "NEW",
      quantityOnHand: 12,
      minQuantity: 4,
      costPriceNet: 28,
      sellPriceNet: 49,
      tradeSellPriceNet: 39,
      fittingChargeNet: 10,
      location: "Tyre rack B",
    },
  ];

  for (const t of demoTyres) {
    const existing = await prisma.tyre.findFirst({
      where: { garageAccountId: demoGarage.id, skuCode: t.skuCode, deletedAt: null },
      select: { id: true },
    });

    const tyreData = {
      brand: t.brand,
      model: t.model ?? null,
      size: t.size,
      loadIndex: t.loadIndex ?? null,
      speedRating: t.speedRating ?? null,
      condition: t.condition,
      quantityOnHand: t.quantityOnHand,
      minQuantity: t.minQuantity,
      costPriceNet: t.costPriceNet,
      sellPriceNet: t.sellPriceNet,
      tradeSellPriceNet: t.tradeSellPriceNet,
      fittingChargeNet: t.fittingChargeNet,
      location: t.location,
      supplierId: euroSupplier?.id ?? null,
      status: "ACTIVE" as const,
    };

    if (!existing) {
      await prisma.tyre.create({
        data: {
          garageAccountId: demoGarage.id,
          skuCode: t.skuCode,
          ...tyreData,
        },
      });
    } else {
      await prisma.tyre.update({ where: { id: existing.id }, data: tyreData });
    }
  }

  console.log("  Tyres: 20555R16MICHELIN, 19565R15CONTINENTAL, 17565R14BUDGET");

  // Ledger (Phase 4) — bank & cash accounts
  const demoAccounts = [
    { name: "Main business account", type: "BANK" as const, openingBalance: 12500 },
    { name: "Petty cash", type: "CASH" as const, openingBalance: 200 },
  ];

  for (const [i, a] of demoAccounts.entries()) {
    const existing = await prisma.paymentAccount.findFirst({
      where: { garageAccountId: demoGarage.id, name: a.name, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      await prisma.paymentAccount.create({
        data: {
          garageAccountId: demoGarage.id,
          name: a.name,
          type: a.type,
          openingBalance: a.openingBalance,
          sortOrder: i,
          isActive: true,
        },
      });
    }
  }

  console.log("  Ledger: Main business account, Petty cash");

  // Phase 5 — account customer + open invoices for payment UAT
  const ownerUser = await prisma.user.findUnique({
    where: { email: "owner@demo.garage" },
    select: { id: true },
  });

  let abcCustomer = await prisma.customer.findFirst({
    where: {
      garageAccountId: demoGarage.id,
      companyName: "ABC Cabs Ltd",
      deletedAt: null,
    },
  });

  if (!abcCustomer) {
    abcCustomer = await prisma.customer.create({
      data: {
        garageAccountId: demoGarage.id,
        type: "BUSINESS",
        companyName: "ABC Cabs Ltd",
        email: "accounts@abccabs.example",
        phone: "020 7946 0100",
        city: "London",
        postcode: "E14 5AB",
        isAccountCustomer: true,
        accountTerms: {
          create: {
            paymentTermsDays: 30,
            billingCycle: "MONTHLY",
            statementDay: 1,
          },
        },
      },
    });
  }

  const demoInvoiceTotals = [250, 180, 120, 450];
  const existingInvCount = await prisma.invoice.count({
    where: { garageAccountId: demoGarage.id, customerId: abcCustomer.id },
  });

  if (existingInvCount === 0 && ownerUser) {
    for (const gross of demoInvoiceTotals) {
      const garage = await prisma.garageAccount.update({
        where: { id: demoGarage.id },
        data: { invoiceNextSeq: { increment: 1 } },
        select: { invoiceNextSeq: true },
      });
      const year = new Date().getFullYear();
      const invoiceNumber = `INV-${year}-${String(garage.invoiceNextSeq).padStart(5, "0")}`;
      const net = gross / 1.2;
      const vat = gross - net;
      const issueDate = new Date();
      const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      await prisma.invoice.create({
        data: {
          garageAccountId: demoGarage.id,
          customerId: abcCustomer.id,
          invoiceNumber,
          status: "SENT",
          issueDate,
          dueDate,
          amountNet: net.toFixed(2),
          amountGross: gross.toFixed(2),
          vatAmount: vat.toFixed(2),
          vehicleRegistration: gross === 250 ? "AB12 CDE" : null,
          notes: "Demo invoice for Phase 5 UAT",
          createdById: ownerUser.id,
          sentAt: new Date(),
          lines: {
            create: [
              {
                lineType: "PARTS",
                description: "Parts & materials",
                quantity: 1,
                unitPriceNet: net.toFixed(2),
                vatRatePercent: "20",
                amountNet: net.toFixed(2),
                vatAmount: vat.toFixed(2),
                amountGross: gross.toFixed(2),
                sortOrder: 0,
              },
            ],
          },
        },
      });
    }
    console.log("  Invoices: 4 open for ABC Cabs Ltd (£250, £180, £120, £450)");
  }

  // Phase 6 — demo repair jobs
  const mechanicUser = await prisma.user.findUnique({
    where: { email: "mechanic@demo.garage" },
    select: { id: true },
  });

  const repairJobCount = await prisma.repairJob.count({
    where: { garageAccountId: demoGarage.id },
  });

  if (repairJobCount === 0 && ownerUser && abcCustomer) {
    const garageSeq = await prisma.garageAccount.update({
      where: { id: demoGarage.id },
      data: { repairNextSeq: { increment: 1 } },
      select: { repairNextSeq: true },
    });
    const year = new Date().getFullYear();
    const jobNumber = `REJ-${year}-${String(garageSeq.repairNextSeq).padStart(5, "0")}`;

    await prisma.repairJob.create({
      data: {
        garageAccountId: demoGarage.id,
        customerId: abcCustomer.id,
        jobNumber,
        status: "IN_PROGRESS",
        source: "CUSTOMER",
        vehicleRegistration: "AB12 CDE",
        vehicleMake: "Ford",
        vehicleModel: "Focus",
        customerConcern: "Clutch slipping under load",
        notes: "Demo repair job for Phase 6 UAT",
        vatEnabled: true,
        vatRatePercent: "20",
        createdById: ownerUser.id,
        tasks: {
          create: [
            {
              title: "Clutch replacement",
              description: "Remove gearbox, fit new clutch kit, road test",
              status: mechanicUser ? "ASSIGNED" : "AVAILABLE",
              assigneeId: mechanicUser?.id ?? null,
              amountNet: "477.5",
              useBreakdown: true,
              labourHours: "4.5",
              labourRateNet: "65",
              sortOrder: 0,
              parts: {
                create: [
                  {
                    description: "Clutch kit (OEM spec)",
                    quantity: "1",
                    unitPriceNet: "185",
                    sortOrder: 0,
                  },
                ],
              },
            },
            {
              title: "Gearbox oil change",
              status: "AVAILABLE",
              amountNet: "57.5",
              useBreakdown: true,
              labourHours: "0.5",
              labourRateNet: "65",
              sortOrder: 1,
              parts: {
                create: [
                  {
                    description: "Gearbox oil 2L",
                    quantity: "2",
                    unitPriceNet: "12.5",
                    sortOrder: 0,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    const garageSeq2 = await prisma.garageAccount.update({
      where: { id: demoGarage.id },
      data: { repairNextSeq: { increment: 1 } },
      select: { repairNextSeq: true },
    });
    const jobNumber2 = `REJ-${year}-${String(garageSeq2.repairNextSeq).padStart(5, "0")}`;

    await prisma.repairJob.create({
      data: {
        garageAccountId: demoGarage.id,
        customerId: abcCustomer.id,
        jobNumber: jobNumber2,
        status: "QUOTE_SENT",
        source: "CUSTOMER",
        vehicleRegistration: "XY99 ZZZ",
        vehicleMake: "Vauxhall",
        vehicleModel: "Astra",
        customerConcern: "Annual service + brake check",
        createdById: ownerUser.id,
        tasks: {
          create: [
            {
              title: "Full service",
              amountNet: "158",
              useBreakdown: true,
              labourHours: "2",
              labourRateNet: "55",
              sortOrder: 0,
              parts: {
                create: [
                  {
                    description: "Service kit (filters, oil)",
                    quantity: "1",
                    unitPriceNet: "48",
                    sortOrder: 0,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    const garageSeq3 = await prisma.garageAccount.update({
      where: { id: demoGarage.id },
      data: { repairNextSeq: { increment: 1 } },
      select: { repairNextSeq: true },
    });
    const jobNumber3 = `REJ-${year}-${String(garageSeq3.repairNextSeq).padStart(5, "0")}`;

    await prisma.repairJob.create({
      data: {
        garageAccountId: demoGarage.id,
        customerId: abcCustomer.id,
        jobNumber: jobNumber3,
        status: "APPROVED",
        source: "CUSTOMER",
        vehicleRegistration: "CD34 EFG",
        vehicleMake: "Toyota",
        vehicleModel: "Corolla",
        customerConcern: "Brake pads worn — approved, awaiting vehicle drop-off",
        createdById: ownerUser.id,
        tasks: {
          create: [
            {
              title: "Front brake pads",
              description: "Replace front pads and skim discs",
              status: "AVAILABLE",
              amountNet: "139.5",
              useBreakdown: true,
              labourHours: "1.5",
              labourRateNet: "65",
              sortOrder: 0,
              parts: {
                create: [
                  {
                    description: "Brake pad set (front)",
                    quantity: "1",
                    unitPriceNet: "42",
                    sortOrder: 0,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    console.log(
      `  Repair jobs: ${jobNumber} (in progress), ${jobNumber2} (quote sent), ${jobNumber3} (approved, claimable)`,
    );
  }

  // Phase 6 — demo bodywork jobs (mechanic work queue: assigned + claimable tasks)
  const bodyworkJobCount = await prisma.bodyworkJob.count({
    where: { garageAccountId: demoGarage.id },
  });

  if (bodyworkJobCount === 0 && ownerUser && abcCustomer) {
    const year = new Date().getFullYear();

    const garageSeq = await prisma.garageAccount.update({
      where: { id: demoGarage.id },
      data: { bodyworkNextSeq: { increment: 1 } },
      select: { bodyworkNextSeq: true },
    });
    const jobNumber = `BWJ-${year}-${String(garageSeq.bodyworkNextSeq).padStart(5, "0")}`;

    await prisma.bodyworkJob.create({
      data: {
        garageAccountId: demoGarage.id,
        customerId: abcCustomer.id,
        jobNumber,
        status: "IN_PROGRESS",
        source: "INSURANCE",
        vehicleRegistration: "FG56 HIJ",
        vehicleMake: "BMW",
        vehicleModel: "3 Series",
        customerConcern: "NS side impact — bumper, door and wing damage",
        colourCode: "300",
        notes: "Demo bodywork job for mechanic work-queue UAT",
        vatEnabled: true,
        vatRatePercent: "20",
        createdById: ownerUser.id,
        tasks: {
          create: [
            {
              panel: "Front bumper",
              title: "Front bumper repair & refinish",
              description: "Strip, fill, prime and paint to colour code 300",
              status: mechanicUser ? "ASSIGNED" : "AVAILABLE",
              assigneeId: mechanicUser?.id ?? null,
              amountNet: "385",
              useBreakdown: true,
              labourHours: "5",
              labourRateNet: "65",
              sortOrder: 0,
            },
            {
              panel: "NS rear door",
              title: "NS rear door blend",
              description: "Localised blend into adjacent panel",
              status: "AVAILABLE",
              amountNet: "97.5",
              useBreakdown: true,
              labourHours: "1.5",
              labourRateNet: "65",
              sortOrder: 1,
            },
          ],
        },
      },
    });

    const garageSeq2 = await prisma.garageAccount.update({
      where: { id: demoGarage.id },
      data: { bodyworkNextSeq: { increment: 1 } },
      select: { bodyworkNextSeq: true },
    });
    const jobNumber2 = `BWJ-${year}-${String(garageSeq2.bodyworkNextSeq).padStart(5, "0")}`;

    await prisma.bodyworkJob.create({
      data: {
        garageAccountId: demoGarage.id,
        customerId: abcCustomer.id,
        jobNumber: jobNumber2,
        status: "QUOTE_SENT",
        source: "CUSTOMER",
        vehicleRegistration: "HK11 LMN",
        vehicleMake: "Audi",
        vehicleModel: "A4",
        customerConcern: "Boot lid dent — awaiting customer approval",
        createdById: ownerUser.id,
        tasks: {
          create: [
            {
              panel: "Boot lid",
              title: "Boot lid dent repair",
              amountNet: "195",
              useBreakdown: true,
              labourHours: "3",
              labourRateNet: "65",
              sortOrder: 0,
            },
          ],
        },
      },
    });

    const garageSeq3 = await prisma.garageAccount.update({
      where: { id: demoGarage.id },
      data: { bodyworkNextSeq: { increment: 1 } },
      select: { bodyworkNextSeq: true },
    });
    const jobNumber3 = `BWJ-${year}-${String(garageSeq3.bodyworkNextSeq).padStart(5, "0")}`;

    await prisma.bodyworkJob.create({
      data: {
        garageAccountId: demoGarage.id,
        customerId: abcCustomer.id,
        jobNumber: jobNumber3,
        status: "APPROVED",
        source: "INSURANCE",
        vehicleRegistration: "PQ78 RST",
        vehicleMake: "Mercedes-Benz",
        vehicleModel: "C-Class",
        customerConcern: "NS wing dent — approved, ready to claim",
        colourCode: "197",
        createdById: ownerUser.id,
        tasks: {
          create: [
            {
              panel: "NS wing",
              title: "NS wing dent repair & refinish",
              description: "PDR where possible, fill and paint to 197",
              status: "AVAILABLE",
              amountNet: "227.5",
              useBreakdown: true,
              labourHours: "3.5",
              labourRateNet: "65",
              sortOrder: 0,
            },
          ],
        },
      },
    });

    console.log(
      `  Bodywork jobs: ${jobNumber} (in progress), ${jobNumber2} (quote sent), ${jobNumber3} (approved, claimable)`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
