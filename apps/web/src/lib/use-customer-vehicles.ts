import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { CustomerDto } from "@mygaragepro/shared";

export type CustomerVehicleOption = {
  registration: string;
  make: string | null;
  model: string | null;
  label: string;
};

export function useCustomerVehicles(customerId: string) {
  const [vehicles, setVehicles] = useState<CustomerVehicleOption[]>([]);

  useEffect(() => {
    if (!customerId) {
      setVehicles([]);
      return;
    }
    void apiFetch<CustomerDto>(`/customers/${customerId}`)
      .then((c) =>
        setVehicles(
          c.vehicles.map((v) => ({
            registration: v.registration,
            make: v.make,
            model: v.model,
            label: [v.registration, v.make, v.model].filter(Boolean).join(" · "),
          })),
        ),
      )
      .catch(() => setVehicles([]));
  }, [customerId]);

  return vehicles;
}
