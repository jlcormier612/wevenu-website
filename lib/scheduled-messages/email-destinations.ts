/**
 * Relationship email destinations for automated (and shared) email delivery.
 * Primary = venue_customer_relationships.email.
 * Partner = leads.partner_email / clients.partner_email.
 * Dedupes case-insensitively; SMS/phone is intentionally out of scope here.
 */

export type EmailDestinationRole = "primary" | "partner";

export type RelationshipEmailContact = {
  primaryEmail: string | null;
  partnerEmail: string | null;
  /** Primary SMS phone — unchanged; partner SMS is out of scope. */
  phone: string | null;
};

export type UniqueEmailDestination = {
  email: string;
  role: EmailDestinationRole;
};

/** Trim + lowercase for comparison only — send uses the first-seen original casing. */
export function normalizeEmailForCompare(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed.toLowerCase();
}

/**
 * Unique email destinations for one relationship send.
 * Identical addresses (any casing) → one destination with primary role.
 */
export function uniqueEmailDestinations(
  contact: Pick<RelationshipEmailContact, "primaryEmail" | "partnerEmail">,
): UniqueEmailDestination[] {
  const out: UniqueEmailDestination[] = [];
  const seen = new Set<string>();

  const push = (raw: string | null | undefined, role: EmailDestinationRole) => {
    const key = normalizeEmailForCompare(raw);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ email: raw!.trim(), role });
  };

  push(contact.primaryEmail, "primary");
  push(contact.partnerEmail, "partner");
  return out;
}
