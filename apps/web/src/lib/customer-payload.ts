import type { DraftCustomer } from "@/components/customers/customer-form";
import { normalizeRegistration } from "@/lib/vehicle-registration";
import type { CustomerDto } from "@mygaragepro/shared";

export function toDraftCustomer(c: CustomerDto): DraftCustomer {
  return {
    id: c.id,
    type: c.type,
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    companyName: c.companyName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    addressLine1: c.addressLine1 ?? "",
    addressLine2: c.addressLine2 ?? "",
    city: c.city ?? "",
    postcode: c.postcode ?? "",
    registration: "",
    make: "",
    model: "",
    isAccountCustomer: c.isAccountCustomer,
    paymentTermsDays: c.accountTerms?.paymentTermsDays ?? 30,
    creditLimit: c.accountTerms?.creditLimit ?? "",
    billingCycle: c.accountTerms?.billingCycle ?? "MONTHLY",
  };
}

export function buildCustomerPayload(draft: DraftCustomer, isEdit: boolean) {
  const body: Record<string, unknown> = {
    type: draft.type,
    email: draft.email || undefined,
    phone: draft.phone || undefined,
    addressLine1: draft.addressLine1 || undefined,
    addressLine2: draft.addressLine2 || undefined,
    city: draft.city || undefined,
    postcode: draft.postcode || undefined,
    isAccountCustomer: draft.isAccountCustomer,
  };

  if (draft.type === "INDIVIDUAL") {
    body.firstName = draft.firstName;
    body.lastName = draft.lastName || undefined;
  } else {
    body.companyName = draft.companyName;
  }

  if (draft.isAccountCustomer) {
    body.accountTerms = {
      paymentTermsDays: draft.paymentTermsDays,
      creditLimit: draft.creditLimit || undefined,
      billingCycle: draft.billingCycle,
    };
  }

  if (!isEdit && draft.registration.trim()) {
    body.vehicles = [
      {
        registration: normalizeRegistration(draft.registration),
        make: draft.make || undefined,
        model: draft.model || undefined,
      },
    ];
  }

  return body;
}
