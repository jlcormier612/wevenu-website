import type { RawIntakeInput } from "@/lib/lead-intake/types";

type FieldDatum = { name: string; values: string[] };

/**
 * Best-effort mapping, same philosophy as the email extractor: recognize
 * common field names directly, stash anything unrecognized into
 * sourceData rather than requiring a venue to manually map every custom
 * question before first use. Meta's own field names vary per form (a
 * venue's custom questions can be named anything), so this is
 * necessarily approximate, not exhaustive.
 */
export function mapFacebookFieldData(fieldData: FieldDatum[]): RawIntakeInput {
  const byName = new Map(fieldData.map((f) => [f.name.toLowerCase(), f.values[0] ?? ""]));
  const get = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = byName.get(k);
      if (v) return v;
    }
    return null;
  };

  const fullName = get("full_name", "name");
  let firstName = get("first_name") ?? "";
  let lastName = get("last_name") ?? "";
  if (!firstName && !lastName && fullName) {
    const parts = fullName.trim().split(/\s+/);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ");
  }

  const recognized = new Set([
    "full_name", "name", "first_name", "last_name", "email", "phone_number",
    "event_type", "event_date", "guest_count",
  ]);
  const sourceData: Record<string, unknown> = {};
  for (const f of fieldData) {
    const key = f.name.toLowerCase();
    if (!recognized.has(key)) sourceData[f.name] = f.values[0] ?? null;
  }

  return {
    firstName: firstName || "Facebook",
    lastName: lastName || "Lead",
    email: get("email"),
    phone: get("phone_number", "phone"),
    partnerFirstName: null,
    partnerLastName: null,
    partnerEmail: null,
    eventType: get("event_type"),
    eventDate: get("event_date"),
    endDate: null,
    guestCount: get("guest_count") ? Number(get("guest_count")) || null : null,
    estimatedBudget: null,
    inquiryMessage: null,
    inquiryDate: null,
    confidenceScore: null,
    sourceData,
  };
}
