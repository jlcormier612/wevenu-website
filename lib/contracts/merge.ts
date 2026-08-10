/**
 * Contract merge-field resolution (Sprint 15).
 * Replaces {{field_name}} tokens with actual data.
 *
 * The find-and-replace mechanics (mergeContent/extractTokens/MergeData) now
 * live in lib/shared-merge/tokens.ts — Work Package D2 found this file and
 * lib/message-templates/merge.ts hand-maintaining byte-for-byte duplicates
 * of the same three exports and consolidated them. Everything below this
 * re-export (buildMergeData and Contracts' own field vocabulary) is
 * genuinely specific to Contracts and stays here.
 */
import { formatContractDate } from "@/lib/contracts/constants";
import { type MergeData } from "@/lib/shared-merge/tokens";

export { mergeContent, extractTokens, type MergeData } from "@/lib/shared-merge/tokens";

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
