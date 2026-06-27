/**
 * Contract merge-field resolution (Sprint 15).
 * Replaces {{field_name}} tokens with actual data.
 */
import { formatContractDate } from "@/lib/contracts/constants";

export type MergeData = Record<string, string>;

/** Replace all {{token}} occurrences. Unknown tokens are left as-is. */
export function mergeContent(template: string, data: MergeData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key as keyof MergeData];
    return value !== undefined ? value : match;
  });
}

/** Extract all {{token}} names from a template string. */
export function extractTokens(template: string): string[] {
  const tokens = new Set<string>();
  for (const [, key] of template.matchAll(/\{\{(\w+)\}\}/g)) {
    tokens.add(key);
  }
  return [...tokens];
}

export type MergeContext = {
  venueName: string;
  clientFirstName: string;
  clientLastName: string;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  eventDate: string | null;
  eventType: string | null;
  guestCount: number | null;
  contractTitle: string;
};

/** Build the MergeData map from domain objects. */
export function buildMergeData(ctx: MergeContext): MergeData {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const primary = `${ctx.clientFirstName} ${ctx.clientLastName}`.trim();
  const partner =
    ctx.partnerFirstName || ctx.partnerLastName
      ? `${ctx.partnerFirstName ?? ""} ${ctx.partnerLastName ?? ""}`.trim()
      : null;
  const coupleName = partner ? `${primary} & ${partner}` : primary;

  const eventTypePretty = ctx.eventType
    ? ctx.eventType.charAt(0).toUpperCase() +
      ctx.eventType.slice(1).replace(/_/g, " ")
    : "";

  return {
    venue_name:           ctx.venueName,
    couple_name:          coupleName,
    primary_contact_name: primary,
    event_date:           ctx.eventDate ? formatContractDate(ctx.eventDate) : "",
    event_type:           eventTypePretty,
    guest_count:          ctx.guestCount != null ? String(ctx.guestCount) : "",
    today_date:           today,
    contract_title:       ctx.contractTitle,
  };
}
