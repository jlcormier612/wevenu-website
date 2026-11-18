/** Parse HTTP Retry-After (integer seconds or HTTP-date). Caps at 24h. */
export function parseRetryAfterSeconds(header: string | null | undefined): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return Math.min(seconds, 24 * 60 * 60);
  }
  const when = Date.parse(trimmed);
  if (Number.isNaN(when)) return null;
  const seconds = Math.ceil((when - Date.now()) / 1000);
  if (seconds <= 0) return null;
  return Math.min(seconds, 24 * 60 * 60);
}
