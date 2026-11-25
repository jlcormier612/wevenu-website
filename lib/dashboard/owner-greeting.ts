/**
 * Resolve the Dashboard greeting first name from the authenticated
 * venue_staff membership — not from venue name, email, or a preferred owner.
 */
export function resolveDashboardGreetingFirstName(opts: {
  fullName: string | null | undefined;
  venueName?: string | null | undefined;
}): string | null {
  const fullName = (opts.fullName ?? "").trim();
  if (!fullName) return null;

  // Never greet with an email address or email-shaped token.
  if (fullName.includes("@")) return null;

  const first = fullName.split(/\s+/).find((part) => part.length > 0) ?? "";
  if (!first || first.includes("@")) return null;

  const venueName = (opts.venueName ?? "").trim().toLowerCase();
  if (venueName) {
    const firstLower = first.toLowerCase();
    const fullLower = fullName.toLowerCase();
    if (fullLower === venueName || firstLower === venueName) return null;

    // Disposable / provisional staff profiles sometimes copy a venue token
    // into full_name (e.g. "Connect Accept" on CONNECT-ACCEPT-DISPOSABLE).
    // Never greet with a token that appears in the venue name.
    const venueTokens = venueName
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3);
    if (venueTokens.includes(firstLower)) return null;
  }

  return first;
}
