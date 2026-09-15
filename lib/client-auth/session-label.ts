/**
 * Human-facing label for an auth session in the client Account UI.
 * Never surfaces raw user-agent strings that are technical identifiers
 * (e.g. "node", container runtimes, UUIDs).
 */
export function sessionDeviceLabel(
  userAgent: string | null | undefined,
  isCurrent: boolean,
): string {
  if (isCurrent) return "This device";

  const raw = (userAgent ?? "").trim();
  if (!raw) return "Other device";

  const lower = raw.toLowerCase();
  // Runtime / tooling identifiers that leak from headless or server sign-ins.
  if (
    lower === "node" ||
    lower.startsWith("node/") ||
    lower.startsWith("node:") ||
    /^(undici|curl\/|python-requests|python\/|axios\/|got\/|postman|insomnia|okhttp)/i.test(raw) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
  ) {
    return "Other device";
  }

  // Real browser UAs — emit a short human label when we can do so reliably.
  const browser =
    /Edg\/|Edge\//i.test(raw) ? "Edge"
    : /Chrome\//i.test(raw) && !/Chromium/i.test(raw) ? "Chrome"
    : /Firefox\//i.test(raw) ? "Firefox"
    : /Safari\//i.test(raw) && !/Chrome\//i.test(raw) ? "Safari"
    : null;
  const os =
    /iPhone|iPad/i.test(raw) ? "iOS"
    : /Android/i.test(raw) ? "Android"
    : /Mac OS X|Macintosh/i.test(raw) ? "Mac"
    : /Windows NT/i.test(raw) ? "Windows"
    : null;

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return "Other device";
}
