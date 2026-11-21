/**
 * Sandbox curated venues that write-capable automated tests must never mutate.
 * Read-only checks against these venues remain allowed.
 */
export const PROTECTED_SANDBOX_VENUE_IDS = {
  WILLOW_GROVE: "31f38b79-eb99-4ebc-81bc-af85767b42aa",
  JENS_FANCY_VENUE: "a415ac52-cd74-42a6-8df7-7a8f6e71d080",
  SWEET_DAISY_BARN: "5c84e74e-355d-4ce1-9e6b-913a9267f543",
} as const;

export const PROTECTED_SANDBOX_VENUE_ID_SET: ReadonlySet<string> = new Set(
  Object.values(PROTECTED_SANDBOX_VENUE_IDS),
);

export const PROTECTED_SANDBOX_VENUE_NAME_RE =
  /^(The Willow Grove|Jen'?s Fancy Venue|Sweet Daisy Barn(?:\s*&\s*Farm)?)$/i;

/**
 * Dual-key founder maintenance override. A single env flag must never silently
 * disable automated QA write protection.
 */
export function isFounderProtectedQaMaintenanceEnabled(): boolean {
  return (
    process.env.HTC_FOUNDER_PROTECTED_QA_MAINTENANCE === "1" &&
    process.env.HTC_ALLOW_PROTECTED_QA_WRITES === "1"
  );
}

export function isProtectedSandboxVenueId(venueId: string | null | undefined): boolean {
  return Boolean(venueId && PROTECTED_SANDBOX_VENUE_ID_SET.has(venueId));
}

export function isProtectedSandboxVenueName(name: string | null | undefined): boolean {
  return Boolean(name && PROTECTED_SANDBOX_VENUE_NAME_RE.test(name.trim()));
}

/**
 * Throw when a write-capable QA path targets a curated venue.
 * Prefer this over name-only conventions.
 */
export function assertWritableQaVenue(input: {
  venueId: string;
  venueName?: string | null;
  purpose?: string;
}): void {
  if (isFounderProtectedQaMaintenanceEnabled()) return;
  if (isProtectedSandboxVenueId(input.venueId) || isProtectedSandboxVenueName(input.venueName)) {
    const purpose = input.purpose ? ` (${input.purpose})` : "";
    throw new Error(
      `REFUSED: write-capable QA must not target curated Sandbox venues${purpose}. ` +
        `venueId=${input.venueId} name=${input.venueName ?? "(unknown)"}. ` +
        `Use an isolated disposable venue with teardown.`,
    );
  }
}

/** True when a venue name looks like an intentional disposable fixture. */
export function looksLikeDisposableVenueName(name: string | null | undefined): boolean {
  if (!name) return false;
  return /\[?DISPOSABLE/i.test(name) || /E2E Disposable/i.test(name) || /hellotocheers-test\.invalid/i.test(name);
}

/**
 * Fail-closed gate for scripts that still hardcode curated venue IDs.
 * Throws unless both founder maintenance env vars are set (explicit dual-key).
 * Read-only scripts should not call this; write scripts must call it at startup
 * with every venue ID they intend to mutate.
 */
export function refuseProtectedVenueHardcodes(input: {
  venueIds: Array<string | null | undefined>;
  purpose?: string;
}): void {
  if (isFounderProtectedQaMaintenanceEnabled()) return;
  for (const id of input.venueIds) {
    if (!id) continue;
    assertWritableQaVenue({ venueId: id, purpose: input.purpose ?? "hardcoded protected venue" });
  }
}

/**
 * Inspect a mutation payload / filter map for venue_id and refuse protected IDs.
 * Used by guarded QA admin clients at actual write entry points.
 */
export function assertWritableVenueIdInPayload(
  payload: unknown,
  purpose = "qa mutation",
): void {
  if (isFounderProtectedQaMaintenanceEnabled()) return;
  const ids = collectVenueIds(payload);
  for (const id of ids) {
    assertWritableQaVenue({ venueId: id, purpose });
  }
}

export function collectVenueIds(value: unknown, out: string[] = []): string[] {
  if (value == null) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectVenueIds(item, out);
    return out;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.venue_id === "string") out.push(obj.venue_id);
    if (typeof obj.venueId === "string") out.push(obj.venueId);
    if (typeof obj.p_venue_id === "string") out.push(obj.p_venue_id);
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") collectVenueIds(v, out);
    }
  }
  return out;
}
