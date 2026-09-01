/**
 * Dashboard Component System — Decision Engine (Venue Dashboard
 * Reconstruction, Phase 1).
 *
 * A real, load-bearing gap this phase found before writing anything:
 * docs/dashboard-luv-experience-architecture.md designed the Decision
 * Engine (Publish -> Classify -> Prioritize -> Route) but it was never
 * implemented as code — no prior phase built a classification pipeline,
 * only the rendering primitives (AttentionList, StatTile, etc.) those
 * classified items would eventually render through. This phase's own
 * brief requires "every piece of information must originate from the
 * Decision Engine," which cannot be literally true of a service that
 * doesn't exist yet.
 *
 * Resolution, stated here rather than silently assumed: this module is
 * the first concrete implementation of that already-certified
 * architecture, scoped narrowly to what this one Dashboard needs — not a
 * general platform-wide service also covering Luv/Notifications/Reports
 * (those remain future work, explicitly out of this phase's scope). It
 * applies exactly the classification rules already written in that
 * architecture document (§2 Ownership, §3 Taxonomy, §5 Priority) to real,
 * already-fetched data (lib/dashboard/service.ts's getDashboardData(),
 * which already computes leads/tasks/payments/events/briefing correctly)
 * — it invents no new rule, no new threshold, no new data source.
 */
import { isOverdue, formatDate as formatLeadDate, leadDisplayName } from "@/lib/leads/constants";
import { formatDate as formatClientDate } from "@/lib/clients/constants";
import { formatDate as formatEventDate } from "@/lib/events/constants";
import { formatDate as formatPaymentDate, formatMoney } from "@/lib/payments/constants";
import type { DashboardData } from "@/lib/dashboard/types";

/** The certified 7-tier Priority Hierarchy (architecture doc §5) — only the 4 this Dashboard is allowed to surface are used here (Historical/Learning/Celebration are Reports/Luv territory, per the same doc's own routing table). */
export type Priority = "critical" | "needs_attention_today" | "upcoming" | "informational";

export type ClassifiedItem = {
  id: string;
  priority: Priority;
  /** Which certified domain (architecture doc §2) published this fact — carried through for the validation report's "Decision Engine coverage" measurement, not rendered. */
  domain: string;
  label: string;
  detail?: string | null;
  href: string;
  /** Renderable right-side content (a date string, "Overdue", "Today", etc.) — kept as plain text, AttentionList's row renderer applies severity styling. */
  rightLabel?: string;
  rightSeverity?: "critical" | "warning" | "informational";
  /** ISO date, for sort ordering — null sorts last. */
  sortDate: string | null;
};

/**
 * CLASSIFY + PRIORITIZE (architecture doc §4) — turns getDashboardData()'s
 * already-fetched, already-domain-owned facts into one classified stream.
 * Every source below is an existing, certified Fact-producing domain
 * (§2's own table); this function only assigns type/priority, it never
 * re-derives a domain's own state a second way.
 */
export function classifyDashboardItems(data: DashboardData): ClassifiedItem[] {
  const today = data.todayIso;
  const items: ClassifiedItem[] = [];

  // ── Leads domain: overdue follow-ups (Needs Attention Today) ──────────
  for (const lead of data.needsAttention) {
    items.push({
      id: `lead-${lead.id}`,
      priority: "needs_attention_today",
      domain: "Leads",
      label: leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName),
      detail: lead.reason,
      href: `/leads/${lead.id}`,
      rightLabel: "Follow up",
      rightSeverity: "warning",
      sortDate: null,
    });
  }

  // ── Leads domain: follow-ups scheduled for today ──────────────────────
  // getDashboardData() has always computed this feed and nothing rendered
  // it, so a follow-up the owner deliberately scheduled for today stayed
  // invisible until the next morning, when it reappeared here as an overdue
  // item via data.needsAttention. The two feeds partition cleanly by
  // definition (followUpDate < today vs. === today, and the stale-inquiry
  // branch requires no follow-up date at all), but they are deduplicated by
  // lead id anyway so a change to either rule can't start double-listing.
  const alreadyAttentioned = new Set(data.needsAttention.map((l) => l.id));
  for (const lead of data.followupsDue) {
    if (alreadyAttentioned.has(lead.id)) continue;
    items.push({
      id: `followup-${lead.id}`,
      priority: "needs_attention_today",
      domain: "Leads",
      label: leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName),
      detail: lead.nextActionText ?? "Follow-up scheduled for today",
      href: `/leads/${lead.id}`,
      rightLabel: "Today",
      rightSeverity: "warning",
      sortDate: today,
    });
  }

  // ── Tasks domain: overdue tasks (Critical — a missed commitment) ──────
  for (const task of data.openTasks) {
    if (!isOverdue(task.dueDate)) continue;
    items.push({
      id: `task-${task.id}`,
      priority: "critical",
      domain: "Tasks",
      label: task.title,
      detail: task.leadName,
      href: `/leads/${task.leadId}`,
      rightLabel: "Overdue",
      rightSeverity: "critical",
      sortDate: task.dueDate,
    });
  }

  // ── Payments domain: deliberately NOT sourced from data.overduePayments
  // here. That feed (raw payment_line_items.status='overdue') and the
  // Event Readiness feed below (data.briefing.needsAttentionNow, which
  // already includes computePaymentsReadiness per booking) both surface
  // "a payment is overdue" — for the same underlying situation, often for
  // the same booking. Rather than merge two sources with no shared id to
  // dedupe against cleanly (DashboardPayment carries no eventId), the
  // certified Daily Briefing feed is used as the one source for payment
  // urgency here — it's the cross-booking, already-certified one (per
  // this phase's own "Use the existing Daily Briefing architecture" rule)
  // — and the raw feed is not separately re-added. This directly targets
  // this phase's own "Duplicate information removed" requirement rather
  // than introducing a new duplicate while building it.

  // ── Bookings/Events domain: tours scheduled today (Needs Attention Today — same-day operational) ──
  for (const lead of data.upcomingTours) {
    if (lead.tourDate !== today) continue;
    items.push({
      id: `tour-${lead.id}`,
      priority: "needs_attention_today",
      domain: "Calendar",
      label: `Tour: ${leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}`,
      detail: lead.tourTime ? `Today at ${lead.tourTime.slice(0, 5)}` : "Today",
      href: `/leads/${lead.id}`,
      rightLabel: "Today",
      rightSeverity: "warning",
      sortDate: lead.tourDate,
    });
  }

  // ── Event Readiness domain (Contracts/Payments/Requests, per-booking) —
  // the existing, certified Daily Briefing engine (lib/luv/briefing-
  // service.ts) already computes this exact "needs_attention" fan-out
  // across every active booking; reused directly, never re-derived. ──
  for (const item of data.briefing.needsAttentionNow) {
    items.push({
      id: item.id,
      priority: "critical",
      domain: "Event Readiness",
      label: item.eventName ?? item.label,
      detail: item.detail,
      href: item.link,
      rightLabel: item.eventDate ? formatEventDate(item.eventDate) : undefined,
      rightSeverity: "critical",
      sortDate: item.eventDate,
    });
  }

  return items;
}

/**
 * Every domain's date-driven Facts, merged into one stream (architecture doc
 * §6's own instruction: "one component," never four).
 *
 * Deliberately NOT exported. Callers take either the today-dated slice or the
 * strictly-future slice, which is what keeps a single fact from being rendered
 * by two Dashboard sections at once: "what needs attention now" and "what is
 * coming later" partition this list rather than overlapping on it.
 */
function classifyDatedItems(data: DashboardData): ClassifiedItem[] {
  const today = data.todayIso;
  const items: ClassifiedItem[] = [];

  for (const lead of data.upcomingTours) {
    // Today's tours are already published as actionable work by
    // classifyDashboardItems, under a different id — excluded here so a tour
    // happening today cannot arrive in the same section twice.
    if (lead.tourDate === today) continue;
    items.push({
      id: `up-tour-${lead.id}`,
      priority: "upcoming",
      domain: "Calendar",
      label: `Tour: ${leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}`,
      detail: "Tour",
      href: `/leads/${lead.id}`,
      rightLabel: lead.tourDate ? formatLeadDate(lead.tourDate) : undefined,
      sortDate: lead.tourDate,
    });
  }

  for (const event of data.upcomingEvents) {
    items.push({
      id: `up-event-${event.id}`,
      priority: "upcoming",
      domain: "Events",
      label: event.clientName ?? event.name,
      detail: "Event",
      href: `/events/${event.id}`,
      rightLabel: formatEventDate(event.eventDate),
      sortDate: event.eventDate,
    });
  }

  for (const payment of data.upcomingPayments) {
    items.push({
      id: `up-payment-${payment.id}`,
      priority: "upcoming",
      domain: "Payments",
      label: payment.label,
      detail: payment.clientName ?? "Payment",
      href: `/payments/${payment.scheduleId}`,
      rightLabel: `${formatMoney(payment.amount)} · ${formatPaymentDate(payment.dueDate)}`,
      sortDate: payment.dueDate,
    });
  }

  for (const kd of data.upcomingKeyDates) {
    items.push({
      id: `up-keydate-${kd.id}`,
      priority: "upcoming",
      domain: "Clients",
      label: kd.label,
      detail: kd.clientName,
      href: `/clients/${kd.clientId}`,
      rightLabel: formatClientDate(kd.date),
      sortDate: kd.date,
    });
  }

  return items.sort((a, b) => (a.sortDate ?? "9999").localeCompare(b.sortDate ?? "9999"));
}

/**
 * The forward-looking slice: strictly later than today.
 *
 * Anything landing today is today's business and belongs to Today's Focus, so
 * Upcoming no longer restates it. Previously only today's *tours* were held
 * back, which left today's events, payments and key dates appearing in both
 * sections at once.
 */
export function classifyUpcomingItems(data: DashboardData): ClassifiedItem[] {
  const today = data.todayIso;
  return classifyDatedItems(data).filter((i) => i.sortDate != null && i.sortDate > today);
}

/** The today-dated slice, which Today's Focus folds in alongside actionable work. */
export function classifyTodayDatedItems(data: DashboardData): ClassifiedItem[] {
  return classifyDatedItems(data).filter((i) => i.sortDate === data.todayIso);
}

const PRIORITY_RANK: Record<Priority, number> = { critical: 0, needs_attention_today: 1, upcoming: 2, informational: 3 };

/** Priority first, then date proximity — the exact ordering rule architecture doc §5/§10 already specifies (never alphabetical, never insertion order). */
export function sortByPriority(items: ClassifiedItem[]): ClassifiedItem[] {
  return [...items].sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return (a.sortDate ?? "9999").localeCompare(b.sortDate ?? "9999");
  });
}

/**
 * Today's Focus: Critical + Needs Attention Today + anything dated
 * specifically today — nothing historical, nothing informational, per this
 * phase's own §1 rule.
 *
 * Returns the full classified set rather than a fixed five. This section used
 * to sit above a separate Today's Attention list that rendered the same
 * classification ten deep, so the briefing could truncate safely — whatever it
 * cut was still on screen directly below. Now that Today's Focus is the only
 * place actionable work appears, truncating here would drop work off the
 * Dashboard entirely, so the caller slices for display and reports the overflow.
 */
export function classifyBriefingItems(data: DashboardData): ClassifiedItem[] {
  const attention = classifyDashboardItems(data);
  const datedToday = classifyTodayDatedItems(data);
  return sortByPriority([...attention, ...datedToday]);
}
