import type { Customer, CustomerAccountTerms, CustomerVehicle } from "@prisma/client";
import type { CustomerDto, CustomerVehicleDto } from "@mygaragepro/shared";

type CustomerWithRelations = Customer & {
  accountTerms: CustomerAccountTerms | null;
  vehicles: CustomerVehicle[];
};

export function customerDisplayName(c: Customer): string {
  if (c.type === "BUSINESS" && c.companyName) return c.companyName;
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unnamed customer";
}

export function toVehicleDto(v: CustomerVehicle): CustomerVehicleDto {
  return {
    id: v.id,
    registration: v.registration,
    make: v.make,
    model: v.model,
    colour: v.colour,
    year: v.year,
    notes: v.notes,
  };
}

export function toCustomerDto(c: CustomerWithRelations): CustomerDto {
  return {
    id: c.id,
    type: c.type,
    displayName: customerDisplayName(c),
    firstName: c.firstName,
    lastName: c.lastName,
    companyName: c.companyName,
    email: c.email,
    phone: c.phone,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2,
    city: c.city,
    postcode: c.postcode,
    notes: c.notes,
    isAccountCustomer: c.isAccountCustomer,
    accountTerms: c.accountTerms
      ? {
          paymentTermsDays: c.accountTerms.paymentTermsDays,
          creditLimit: c.accountTerms.creditLimit?.toString() ?? null,
          billingCycle: c.accountTerms.billingCycle,
          statementDay: c.accountTerms.statementDay,
        }
      : null,
    vehicles: c.vehicles.filter((v) => !v.deletedAt).map(toVehicleDto),
    deletedAt: c.deletedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

export function normalizeRegistration(reg: string): string {
  return reg.replace(/\s+/g, "").toUpperCase();
}
