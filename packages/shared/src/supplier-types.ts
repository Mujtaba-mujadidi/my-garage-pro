export type SupplierStatus = "ACTIVE" | "INACTIVE";

export type SupplierDto = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  vatNumber: string | null;
  notes: string | null;
  status: SupplierStatus;
  deletedAt: string | null;
  createdAt: string;
};

