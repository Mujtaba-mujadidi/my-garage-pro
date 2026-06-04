import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient, UserRole } from "@prisma/client";

loadEnv({ path: resolve(__dirname, "../.env") });
import * as argon2 from "argon2";
import {
  DEFAULT_ENABLED_MODULES,
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

  await seedGarageModules(demoGarage.id, DEFAULT_ENABLED_MODULES);
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
