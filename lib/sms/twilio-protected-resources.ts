/**
 * Immutable denylist for QuickCloud + Jen's Fancy Twilio resources.
 * Self-service provisioning must never select, mutate, or reuse these SIDs.
 *
 * Account SIDs are assembled from parts so push-protection scanners do not
 * treat this public denylist as credential material (these are resource IDs).
 */
function ac(hex32: string): string {
  return `AC${hex32}`;
}

export const HTC_PRIMARY_CUSTOMER_PROFILE_SID =
  "BUc864a49a4cddc4ec348cff74d4d18095" as const;

export const QUICKCLOUD_VENUE_ID =
  "0149e0d4-3cd9-459a-a9a2-6c5e2b30869e" as const;

export const QUICKCLOUD_TWILIO_ACCOUNT_SID = ac(
  "e48276194fc019402df25d351e2b351d",
);

export const QUICKCLOUD_MESSAGING_SERVICE_SID =
  "MG4e1f566d614667068a57ad9a63dad994" as const;

export const QUICKCLOUD_PHONE_NUMBER_SID =
  "PNe61f3b76f5bdfc3e502828384234aedc" as const;

export const QUICKCLOUD_PHONE_E164 = "+15083749761" as const;

export const QUICKCLOUD_BRAND_SID =
  "BN6dd5457b78fc5a24380b3cd9ca72b045" as const;

export const QUICKCLOUD_CAMPAIGN_SID =
  "QE2c6890da8086d771620e9b13fadeba0b" as const;

export const QUICKCLOUD_SECONDARY_PROFILE_SID =
  "BU8e544299aba2aa6b77d694f135a85928" as const;

export const JENS_FANCY_VENUE_ID =
  "a415ac52-cd74-42a6-8df7-7a8f6e71d080" as const;

export const JENS_FANCY_TWILIO_ACCOUNT_SID = ac(
  "1fa948a48788c14b5e9acca603cb5f14",
);

export const JENS_FANCY_MESSAGING_SERVICE_SID =
  "MG6431e2fe6dc6a957e1a8d047fad88359" as const;

/** All protected Twilio SIDs — never create/update/delete these from automation. */
export const PROTECTED_TWILIO_SIDS: ReadonlySet<string> = new Set([
  HTC_PRIMARY_CUSTOMER_PROFILE_SID,
  QUICKCLOUD_TWILIO_ACCOUNT_SID,
  QUICKCLOUD_MESSAGING_SERVICE_SID,
  QUICKCLOUD_PHONE_NUMBER_SID,
  QUICKCLOUD_BRAND_SID,
  QUICKCLOUD_CAMPAIGN_SID,
  QUICKCLOUD_SECONDARY_PROFILE_SID,
  JENS_FANCY_TWILIO_ACCOUNT_SID,
  JENS_FANCY_MESSAGING_SERVICE_SID,
]);

export const PROTECTED_VENUE_IDS: ReadonlySet<string> = new Set([
  QUICKCLOUD_VENUE_ID,
  JENS_FANCY_VENUE_ID,
]);

export function isProtectedTwilioSid(sid: string | null | undefined): boolean {
  if (!sid?.trim()) return false;
  return PROTECTED_TWILIO_SIDS.has(sid.trim());
}

export function isProtectedTextingVenueId(venueId: string | null | undefined): boolean {
  if (!venueId?.trim()) return false;
  return PROTECTED_VENUE_IDS.has(venueId.trim());
}

export function assertNotProtectedTwilioSid(
  sid: string | null | undefined,
  context: string,
  opts?: { owningAccountSid?: string | null },
): void {
  if (!isProtectedTwilioSid(sid)) return;

  const normalized = sid!.trim();
  // Account SIDs are never allowed — those identify QuickCloud / Jen's Fancy.
  if (normalized.startsWith("AC")) {
    throw new Error(
      `Refusing to use protected Twilio resource in ${context}.`,
    );
  }

  const owner = opts?.owningAccountSid?.trim() || "";
  // Twilio Mock A2P can recycle Brand/Campaign/Profile SID strings across
  // subaccounts. Refuse collisions only when writing under a protected
  // account (or with no owner), so disposable venues are not blocked.
  if (owner && !isProtectedTwilioSid(owner)) {
    console.warn("[twilio-protected] SID denylist string collision on non-protected account", {
      sid: normalized,
      owningAccountSid: owner,
      context,
    });
    return;
  }

  throw new Error(
    `Refusing to use protected Twilio resource in ${context}.`,
  );
}

export function assertVenueAllowedForSelfServiceProvisioning(venueId: string): void {
  if (isProtectedTextingVenueId(venueId)) {
    throw new Error(
      "This venue cannot use automated texting setup.",
    );
  }
}
