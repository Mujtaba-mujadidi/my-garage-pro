/** Strip spaces and uppercase — matches API storage (e.g. WP67 LUV → WP67LUV). */
export function normalizeRegistration(reg: string): string {
  return reg.replace(/\s+/g, "").toUpperCase();
}
