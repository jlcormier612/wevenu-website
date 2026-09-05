/** Guard: analytics event params must never include PII field names. */

export const PII_PARAM_KEYS = [
  "email",
  "name",
  "phone",
  "message",
  "address",
  "first_name",
  "last_name",
  "full_name",
  "client_email",
  "client_name",
  "client_phone",
] as const;

export function assertAnalyticsParamsHaveNoPii(
  params: Record<string, unknown> | undefined,
): void {
  if (!params) return;
  for (const key of Object.keys(params)) {
    const lower = key.toLowerCase();
    if ((PII_PARAM_KEYS as readonly string[]).includes(lower)) {
      throw new Error(`Analytics payload must not include PII key: ${key}`);
    }
  }
}
