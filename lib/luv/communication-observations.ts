/**
 * Luv — Communication observations. Communication Trust Experience, Phase 8.
 *
 * Once Communication Trust is established (Phases 1-7), Luv summarizes it
 * in plain English — no percentages, no provider/webhook language. This is
 * read-only on top of the status lifecycle built in Phase 3; it invents no
 * new tracking of its own. Kept in its own file rather than folded into
 * lib/luv/observations.ts, which is already large and covers a different
 * surface area (events, contracts, tours) — Communication reads a
 * different set of tables entirely.
 */
import type { LuvObservation } from "@/lib/luv/types";
import { translateEmailFailure, translateSmsFailure } from "@/lib/communication/failure-messages";

type DbClient = Awaited<ReturnType<typeof import("@/integrations/supabase/server").createClient>>;

const STALE_UNOPENED_DAYS = 5;

export async function getCommunicationObservations(
  supabase: DbClient,
  venueId: string,
): Promise<LuvObservation[]> {
  const observations: LuvObservation[] = [];

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const staleThreshold = new Date(Date.now() - STALE_UNOPENED_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [legacyRecent, conversationRecent] = await Promise.all([
    supabase.from("messages")
      .select("id, status, error_message, updated_at")
      .eq("venue_id", venueId).eq("direction", "outbound").neq("status", "draft")
      .gte("created_at", yesterday),
    supabase.from("conversation_messages")
      .select("id, channel, status, failure_reason, sent_at, conversation_id")
      .eq("venue_id", venueId).in("sender_type", ["venue_staff", "system"]).not("status", "is", null)
      .gte("sent_at", yesterday),
  ]);

  type LegacyRow = { id: string; status: string | null; error_message: string | null; updated_at: string };
  type ConvRow = { id: string; channel: string; status: string | null; failure_reason: string | null; sent_at: string };
  const legacyRows = (legacyRecent.data ?? []) as unknown as LegacyRow[];
  const convRows = (conversationRecent.data ?? []) as unknown as ConvRow[];
  const allRecent = [...legacyRows.map((r) => ({ status: r.status, reason: r.error_message })), ...convRows.map((r) => ({ status: r.status, reason: r.failure_reason }))];

  const failedRecent = allRecent.filter((r) => r.status === "failed");

  // "Everything sent yesterday reached its destination." — only said when
  // there's real activity to report and it genuinely all worked; silence
  // when there's nothing sent, rather than a hollow "0 sent, 0 failed."
  if (allRecent.length > 0 && failedRecent.length === 0) {
    observations.push({
      id: "comm-all-delivered",
      kind: "celebration",
      priority: "low",
      message: `Everything sent in the last day reached its destination — ${allRecent.length} message${allRecent.length === 1 ? "" : "s"}, no failures.`,
      link: "/messaging/health",
      actionLabel: "View →",
    });
  }

  // "Two messages couldn't be delivered because the email addresses appear
  // invalid." — grouped by plain-language reason, not a raw error dump.
  if (failedRecent.length > 0) {
    const reasonCounts = new Map<string, number>();
    for (const f of failedRecent) {
      const plain = f.reason
        ? (allRecent.indexOf(f) < legacyRows.length ? translateEmailFailure(f.reason) : translateSmsFailure(f.reason))
        : "Your message couldn't be delivered.";
      reasonCounts.set(plain, (reasonCounts.get(plain) ?? 0) + 1);
    }
    const [topReason, topCount] = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    observations.push({
      id: "comm-recent-failures",
      kind: "risk",
      priority: failedRecent.length >= 3 ? "high" : "medium",
      message: `${failedRecent.length} message${failedRecent.length === 1 ? "" : "s"} couldn't be delivered in the last day${topCount === failedRecent.length ? ` — ${topReason.toLowerCase()}` : "."}`,
      detail: topCount < failedRecent.length ? `Most common reason: ${topReason.toLowerCase()}` : undefined,
      link: "/messaging/health",
      actionLabel: "Review →",
      recommendation: { label: "Review what happened", link: "/messaging/health", type: "navigate" },
    });
  }

  // "One couple hasn't opened your proposal in five days." — a delivered-
  // but-unopened email, sitting long enough that it's worth a nudge rather
  // than a normal "give it time" wait.
  const { data: staleUnopened } = await supabase.from("messages")
    .select("id, subject, updated_at, thread_id")
    .eq("venue_id", venueId).eq("direction", "outbound").eq("status", "delivered")
    .lt("updated_at", staleThreshold)
    .order("updated_at")
    .limit(1);

  type StaleRow = { id: string; subject: string | null; updated_at: string; thread_id: string };
  const stale = ((staleUnopened ?? []) as StaleRow[])[0];
  if (stale) {
    const { data: thread } = await supabase.from("message_threads")
      .select("lead_id").eq("id", stale.thread_id).maybeSingle<{ lead_id: string | null }>();
    let name = "One lead";
    if (thread?.lead_id) {
      const { data: lead } = await supabase.from("leads")
        .select("first_name, partner_first_name").eq("id", thread.lead_id)
        .maybeSingle<{ first_name: string; partner_first_name: string | null }>();
      if (lead) name = [lead.first_name, lead.partner_first_name ? `& ${lead.partner_first_name}` : null].filter(Boolean).join(" ");
    }
    const days = Math.floor((Date.now() - new Date(stale.updated_at).getTime()) / (24 * 60 * 60 * 1000));
    observations.push({
      id: `comm-stale-unopened-${stale.id}`,
      kind: "waiting",
      priority: days >= 10 ? "medium" : "low",
      message: `${name} hasn't opened "${stale.subject ?? "your message"}" in ${days} day${days === 1 ? "" : "s"}.`,
      link: thread?.lead_id ? `/leads/${thread.lead_id}` : "/messaging/health",
      actionLabel: "View →",
      recommendation: thread?.lead_id
        ? { label: "Send a follow-up", link: `/leads/${thread.lead_id}?luv=followup`, type: "draft" }
        : undefined,
    });
  }

  return observations;
}
