/**
 * Stable public URL for a purpose-specific Public Form.
 * Distinct from the venue-global inquiry form at /form/{embed_key}.
 */
export function publicFormPath(publicKey: string): string {
  const key = publicKey.trim();
  if (!key) return "";
  return `/forms/${encodeURIComponent(key)}`;
}

export function publicFormAbsoluteUrl(publicKey: string, origin: string): string {
  const path = publicFormPath(publicKey);
  if (!path) return "";
  return `${origin.replace(/\/$/, "")}${path}`;
}
