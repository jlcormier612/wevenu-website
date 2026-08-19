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
 *
 * Starter Message Library: optional context fields (tour_datetime, payment_*,
 * task_name) are ONLY placed in MergeData when a real value exists — never
 * as empty strings — so mergeContent leaves the literal {{token}} for the
 * caller to refuse sending rather than blanking personalization.
 */
import { type MergeData } from "@/lib/shared-merge/tokens";
import { extractTokens, mergeContent } from "@/lib/shared-merge/tokens";

export { mergeContent, extractTokens, type MergeData } from "@/lib/shared-merge/tokens";

export type MergeContext = {
  venueName: string;
  clientName: string;
  /**
   * Separate first/last, when the caller has them on hand (clients/leads
   * already store these as canonical separate columns). Optional so every
   * existing call site keeps working unchanged — but when present, these
   * back real {{first_name}}/{{last_name}} tokens. Never derived by
   * splitting clientName; a caller without real separate data simply
   * omits these and the tokens stay unresolved rather than guessed.
   */
  clientFirstName?: string | null;
  clientLastName?: string | null;
  coordinatorName: string;
  eventDate: string | null;  // ISO "YYYY-MM-DD"
  /** Work Package D5E — share dialogs; optional on scheduled sends. */
  eventName?: string | null;
  /**
   * Live tour appointment wall-clock in the venue timezone, already formatted
   * for customers (e.g. "Saturday, June 12, 2027 at 2:00 PM"). Omit when no
   * authoritative tour context exists — never invent.
   */
  tourDatetime?: string | null;
  /** Payment line label from the authoritative payment plan line. */
  paymentLabel?: string | null;
  /** Formatted currency amount from the authoritative payment plan line. */
  paymentAmount?: string | null;
  /** Formatted due date from the authoritative payment plan line. */
  paymentDueDate?: string | null;
  /**
   * Planning task title when sending from a task-linked compose path.
   * Absent from scheduled send context until a task link exists.
   */
  taskName?: string | null;
};

function formatMergeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function daysUntil(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const target = new Date(Number(y), Number(m) - 1, Number(d));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return String(diff);
}

/** Build the MergeData map from domain objects. Optional tokens only when present. */
export function buildMergeData(ctx: MergeContext): MergeData {
  const data: MergeData = {
    venue_name:        ctx.venueName,
    client_name:       ctx.clientName,
    coordinator_name:  ctx.coordinatorName,
    event_date:        formatMergeDate(ctx.eventDate),
    days_until_event:  daysUntil(ctx.eventDate),
  };

  if (ctx.clientFirstName) {
    data.first_name = ctx.clientFirstName;
  }
  if (ctx.clientLastName) {
    data.last_name = ctx.clientLastName;
  }
  if (ctx.eventName != null && ctx.eventName !== "") {
    data.event_name = ctx.eventName;
  }
  if (ctx.tourDatetime) {
    data.tour_datetime = ctx.tourDatetime;
  }
  if (ctx.paymentLabel) {
    data.payment_label = ctx.paymentLabel;
  }
  if (ctx.paymentAmount) {
    data.payment_amount = ctx.paymentAmount;
  }
  if (ctx.paymentDueDate) {
    data.payment_due_date = ctx.paymentDueDate;
  }
  if (ctx.taskName) {
    data.task_name = ctx.taskName;
  }

  return data;
}

/**
 * After mergeContent, any remaining {{token}} would reach the customer as
 * literal template syntax — refuse that path (D8 + Starter Library security).
 */
export function unresolvedMergeTokens(text: string): string[] {
  return extractTokens(text);
}

export function assertCustomerSafeMergedContent(
  body: string,
  subject?: string | null,
): { ok: true } | { ok: false; message: string; tokens: string[] } {
  const tokens = [
    ...unresolvedMergeTokens(body),
    ...(subject ? unresolvedMergeTokens(subject) : []),
  ];
  const unique = [...new Set(tokens)];
  if (unique.length === 0) return { ok: true };

  const needsTour = unique.includes("tour_datetime");
  const needsPayment = unique.some((t) =>
    t === "payment_label" || t === "payment_amount" || t === "payment_due_date",
  );
  const needsTask = unique.includes("task_name");

  const hints: string[] = [];
  if (needsTour) hints.push("a tour date/time");
  if (needsPayment) hints.push("a specific payment from their payment plan");
  if (needsTask) hints.push("a planning task");
  if (hints.length === 0) {
    hints.push("the missing client or event details");
  }

  return {
    ok: false,
    tokens: unique,
    message: `This message still has unfilled details (${unique.map((t) => `{{${t}}}`).join(", ")}). Add ${hints.join(" and ")} before sending, or edit the template so it doesn’t need them.`,
  };
}

/** Merge subject/body and refuse customer delivery when tokens remain. */
export function resolveForCustomerSend(
  body: string,
  subject: string | null | undefined,
  ctx: MergeContext,
): { ok: true; body: string; subject: string | null } | { ok: false; message: string; tokens: string[] } {
  const mergeData = buildMergeData(ctx);
  const resolvedBody = mergeContent(body, mergeData);
  const resolvedSubject = subject != null ? mergeContent(subject, mergeData) : null;
  const safe = assertCustomerSafeMergedContent(resolvedBody, resolvedSubject);
  if (!safe.ok) return safe;
  return { ok: true, body: resolvedBody, subject: resolvedSubject };
}
