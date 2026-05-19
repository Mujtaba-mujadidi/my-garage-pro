import { PrismaClient, UserRole } from "@prisma/client";
import * as argon2 from "argon2";
import {
  CONFIGURABLE_ROLES,
  DEFAULT_ENABLED_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
  GARAGE_PERMISSIONS,
  MODULE_KEYS,
  type ConfigurableRole,
  type ModuleKey,
} from "@mygaragepro/shared";

const prisma = new PrismaClient();

const DEFAULT_EXPENSE_CATEGORIES = [
  "Parts purchase",
  "Subcontractor",
  "Utilities",
  "Rent",
  "Marketing",
];

const DEFAULT_VAT_RATES = [
  { label: "Standard VAT 20%", value: "20" },
  { label: "Reduced VAT 5%", value: "5" },
  { label: "Zero rated", value: "0" },
];

async function hashPassword(password: string) {
  return argon2.hash(password);
}

async function seedGarageModules(garageAccountId: string, enabled: ModuleKey[]) {
  for (const moduleKey of MODULE_KEYS) {
    await prisma.garageAccountModule.upsert({
      where: {
        garageAccountId_moduleKey: { garageAccountId, moduleKey },
      },
      create: {
        garageAccountId,
        moduleKey,
        enabled: enabled.includes(moduleKey),
      },
      update: { enabled: enabled.includes(moduleKey) },
    });
  }
}

async function seedRolePermissions(garageAccountId: string) {
  for (const role of CONFIGURABLE_ROLES) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role as ConfigurableRole];
    for (const permission of GARAGE_PERMISSIONS) {
      await prisma.garageRolePermission.upsert({
        where: {
          garageAccountId_role_permission: {
            garageAccountId,
            role,
            permission,
          },
        },
        create: {
          garageAccountId,
          role,
          permission,
          granted: defaults.includes(permission),
        },
        update: {},
      });
    }
  }
}

async function seedSettings(garageAccountId: string) {
  for (let i = 0; i < DEFAULT_EXPENSE_CATEGORIES.length; i++) {
    const label = DEFAULT_EXPENSE_CATEGORIES[i];
    await prisma.settingOption.create({
      data: {
        garageAccountId,
        optionType: "expense_category",
        label,
        value: label.toLowerCase().replace(/\s+/g, "_"),
        sortOrder: i,
      },
    });
  }
  for (let i = 0; i < DEFAULT_VAT_RATES.length; i++) {
    const row = DEFAULT_VAT_RATES[i];
    await prisma.settingOption.create({
      data: {
        garageAccountId,
        optionType: "vat_rate",
        label: row.label,
        value: row.value,
        sortOrder: i,
      },
    });
  }
}

async function main() {
  const superEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@mygaragepro.app";
  const superPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMeAdmin1!";

  await prisma.user.upsert({
    where: { email: superEmail },
    create: {
      email: superEmail,
      displayName: "Platform Super Admin",
      role: UserRole.SUPER_ADMIN,
      passwordHash: await hashPassword(superPassword),
    },
    update: {
      displayName: "Platform Super Admin",
      role: UserRole.SUPER_ADMIN,
      passwordHash: await hashPassword(superPassword),
      status: "ACTIVE",
    },
  });

  const demoGarage = await prisma.garageAccount.upsert({
    where: { slug: "demo-garage" },
    create: {
      name: "Demo Garage Ltd",
      slug: "demo-garage",
      status: "ACTIVE",
    },
    update: { name: "Demo Garage Ltd", status: "ACTIVE" },
  });

  await seedGarageModules(demoGarage.id, DEFAULT_ENABLED_MODULES);

  const existingRolePerms = await prisma.garageRolePermission.count({
    where: { garageAccountId: demoGarage.id },
  });
  if (existingRolePerms === 0) {
    await seedRolePermissions(demoGarage.id);
  }

  const existingSettings = await prisma.settingOption.count({
    where: { garageAccountId: demoGarage.id, deletedAt: null },
  });
  if (existingSettings === 0) {
    await seedSettings(demoGarage.id);
  }

  const demoUsers: { email: string; displayName: string; role: UserRole; password: string }[] = [
    { email: "owner@demo.garage", displayName: "James Owner", role: UserRole.OWNER, password: "demo" },
    { email: "manager@demo.garage", displayName: "Sam Manager", role: UserRole.MANAGER, password: "demo" },
    { email: "mechanic@demo.garage", displayName: "Mike Mechanic", role: UserRole.MECHANIC, password: "demo" },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        garageAccountId: demoGarage.id,
        passwordHash: await hashPassword(u.password),
      },
      update: {
        displayName: u.displayName,
        role: u.role,
        garageAccountId: demoGarage.id,
        passwordHash: await hashPassword(u.password),
        status: "ACTIVE",
      },
    });
  }

  console.log("Seed complete.");
  console.log(`  Super Admin: ${superEmail} / (see SEED_SUPER_ADMIN_PASSWORD or default)`);
  console.log("  Demo garage: owner@demo.garage / demo");
  console.log("               manager@demo.garage / demo");
  console.log("               mechanic@demo.garage / demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
