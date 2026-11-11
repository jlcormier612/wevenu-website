/** Safe optional login email prefill from a query param. Never treats this as identity. */
export function safeLoginEmailPrefill(raw: unknown): string | undefined {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email || email.length > 254) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined;
  return email;
}
