/**
 * Resolve a public Calendly embed URL from env.
 * Returns null when unset, placeholder, or not a calendly.com URL —
 * so the Walkthrough page can show a truthful Contact fallback.
 */

export function resolveCalendlyEmbedUrl(
  raw: string | undefined | null,
): string | null {
  const value = raw?.trim() || "";
  if (!value) return null;

  const lower = value.toLowerCase();
  if (
    lower.includes("your-link") ||
    lower.includes("example.com") ||
    lower.includes("placeholder")
  ) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (host !== "calendly.com" && !host.endsWith(".calendly.com")) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}
