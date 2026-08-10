/**
 * Message template merge-field resolution — Communication Platform Phase 1
 * (mechanics) and Phase 2 (real call site: Scheduled Sends).
 *
 * The find-and-replace mechanics (mergeContent/extractTokens/MergeData) now
 * live in lib/shared-merge/tokens.ts — this file and lib/contracts/merge.ts
 * were hand-maintaining byte-for-byte duplicates of the same three exports
 * (Work Package D2 consolidation). Everything below (buildMergeData and
 * Message Templates' own field vocabulary) is genuinely specific to this
 * system and stays here.
 */
import { type MergeData } from "@/lib/shared-merge/tokens";

export { mergeContent, extractTokens, type MergeData } from "@/lib/shared-merge/tokens";

// ---- Merge context (Phase 2 — real call site: Scheduled Sends) -------------
// task_name has no real value yet — nothing links a scheduled/sequenced
// message to a Planning task in this phase (docs/communication-platform-next-phase.md
// §3.0/§4's task-link is a later phase). Left absent from MergeContext
// entirely rather than always empty — mergeContent already leaves an unknown
// token as-is, so {{task_name}} in a template simply won't resolve until a
// real call site provides it.

export type MergeContext = {
  venueName: string;
  clientName: string;
  coordinatorName: string;
  eventDate: string | null;  // ISO "YYYY-MM-DD"
};

function formatMergeDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function daysUntil(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const target = new Date(Number(y), Number(m) - 1, Number(d));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return String(diff);
}

/** Build the MergeData map from domain objects — mirrors lib/contracts/merge.ts's buildMergeData. */
export function buildMergeData(ctx: MergeContext): MergeData {
  return {
    venue_name:        ctx.venueName,
    client_name:       ctx.clientName,
    coordinator_name:  ctx.coordinatorName,
    event_date:        formatMergeDate(ctx.eventDate),
    days_until_event:  daysUntil(ctx.eventDate),
  };
}
