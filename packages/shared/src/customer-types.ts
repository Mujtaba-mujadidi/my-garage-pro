export type CustomerType = "INDIVIDUAL" | "BUSINESS";
export type BillingCycle = "PER_JOB" | "WEEKLY" | "MONTHLY";

export type CustomerVehicleDto = {
  id: string;
  registration: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  year: number | null;
  notes: string | null;
};

export type CustomerAccountTermsDto = {
  paymentTermsDays: number;
  creditLimit: string | null;
  billingCycle: BillingCycle;
  statementDay: number | null;
};

export type CustomerDto = {
  id: string;
  type: CustomerType;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  notes: string | null;
  isAccountCustomer: boolean;
  /** @deprecated VAT is set per repair job; kept for API compatibility. */
  chargeVat: boolean;
  accountTerms: CustomerAccountTermsDto | null;
  vehicles: CustomerVehicleDto[];
  deletedAt: string | null;
  createdAt: string;
};
