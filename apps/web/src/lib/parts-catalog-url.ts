/** Build the parts list URL, optionally filtered to a job vehicle's make/model. */
export function partsCatalogUrl(
  vehicleMake?: string | null,
  vehicleModel?: string | null,
): string {
  const params = new URLSearchParams();
  if (vehicleMake?.trim()) params.set("vehicleMake", vehicleMake.trim());
  if (vehicleModel?.trim()) params.set("vehicleModel", vehicleModel.trim());
  const qs = params.toString();
  return `/parts${qs ? `?${qs}` : ""}`;
}
