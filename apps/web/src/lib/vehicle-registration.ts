/** Strip spaces and uppercase — matches API storage (e.g. WP67 LUV → WP67LUV). */
export function normalizeRegistration(reg: string): string {
  return reg.replace(/\s+/g, "").toUpperCase();
}

/** Display spacing for common UK formats (e.g. AB12CDE → AB12 CDE). */
export function formatRegistrationDisplay(reg: string): string {
  const normalized = normalizeRegistration(reg);
  if (!normalized) return "";

  const current = normalized.match(/^([A-Z]{2}\d{2})([A-Z]{3})$/);
  if (current) return `${current[1]} ${current[2]}`;

  const prefix = normalized.match(/^([A-Z]\d{1,3})([A-Z]{3})$/);
  if (prefix) return `${prefix[1]} ${prefix[2]}`;

  const suffix = normalized.match(/^([A-Z]{3})(\d{1,3}[A-Z]?)$/);
  if (suffix) return `${suffix[1]} ${suffix[2]}`;

  return normalized;
}
