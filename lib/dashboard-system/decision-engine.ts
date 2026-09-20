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
import { comingUpHorizonEnd } from "@/lib/clients/list-filters";
import { isOverdue, formatDate as formatLeadDate, leadDisplayName } from "@/lib/leads/constants";
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
  /**
   * Cross-section dedupe key — "type:id" of the real underlying entity this
   * item is about, set ONLY where another Dashboard section's item is confirmed
   * to represent the exact same entity. null means no other section currently
   * has a comparable item.
   */
  crossSectionSubject: string | null;
};

/** Collects the non-null cross-section subjects already claimed by a set of items. */
export function collectCrossSectionSubjects(
  items: readonly { crossSectionSubject: string | null }[],
): Set<string> {
  const out = new Set<string>();
  for (const item of items) {
    if (item.crossSectionSubject) out.add(item.crossSectionSubject);
  }
  return out;
}

/** Removes items whose cross-section subject is already claimed by a higher-priority section. */
export function excludeByCrossSectionSubject<T extends { crossSectionSubject: string | null }>(
  items: readonly T[],
  claimed: ReadonlySet<string>,
): T[] {
  return items.filter((item) => !item.crossSectionSubject || !claimed.has(item.crossSectionSubject));
}

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
      href: `/leads/${lead.id}?tab=messages`,
      rightLabel: "Follow up",
      rightSeverity: "warning",
      sortDate: null,
      crossSectionSubject: `lead:${lead.id}`,
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
      href: `/leads/${lead.id}?tab=messages`,
      rightLabel: "Today",
      rightSeverity: "warning",
      sortDate: today,
      crossSectionSubject: `lead:${lead.id}`,
    });
  }

  // ── Tasks domain: overdue lead_tasks (Critical — a missed commitment) ─
  // crossSectionSubject stays null: these are lead_tasks (pipeline-stage
  // tasks), a different table from Task Center event_tasks.
  for (const task of data.openTasks) {
    if (!isOverdue(task.dueDate)) continue;
    items.push({
      id: `task-${task.id}`,
      priority: "critical",
      domain: "Tasks",
      label: task.title,
      detail: task.leadName,
      href: `/leads/${task.leadId}?tab=tasks`,
      rightLabel: "Overdue",
      rightSeverity: "critical",
      sortDate: task.dueDate,
      crossSectionSubject: null,
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

  // ── Tours scheduled today — Tours surface owns the appointment list ──
  for (const lead of data.upcomingTours) {
    if (lead.tourDate !== today) continue;
    items.push({
      id: `tour-${lead.id}`,
      priority: "needs_attention_today",
      domain: "Calendar",
      label: `Tour: ${leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}`,
      detail: lead.tourTime ? `Today at ${lead.tourTime.slice(0, 5)}` : "Today",
      href: `/tours`,
      rightLabel: "Today",
      rightSeverity: "warning",
      sortDate: lead.tourDate,
      // Deliberately null, not `lead:{id}` — a tour today and a stale
      // follow-up are different obligations about the same lead. Suppressing
      // the follow-up because a tour is showing would lose real information.
      crossSectionSubject: null,
    });
  }

  // ── Event Readiness domain (Contracts/Payments/Requests, per-booking) —
  // the existing, certified Daily Briefing engine (lib/luv/briefing-
  // service.ts) already computes this exact "needs_attention" fan-out
  // across every active booking; reused directly, never re-derived. ──
  for (const item of data.briefing.needsAttentionNow) {
    const who = item.eventName?.trim() || null;
    items.push({
      id: item.id,
      priority: "critical",
      domain: "Event Readiness",
      // Issue first (what), then who/where (detail) — not a generic booking dump.
      label: item.detail?.trim() || item.label,
      detail: who ? `${item.label} · ${who}` : item.label,
      href: item.link,
      rightLabel: item.eventDate ? formatEventDate(item.eventDate) : undefined,
      rightSeverity: "critical",
      sortDate: item.eventDate,
      crossSectionSubject: null,
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
      href: `/tours`,
      rightLabel: lead.tourDate ? formatLeadDate(lead.tourDate) : undefined,
      sortDate: lead.tourDate,
      // Same reasoning as today's tour item above: not the same obligation
      // as a lead follow-up, even for the same lead.
      crossSectionSubject: null,
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
      // No other section currently emits a comparable per-event key.
      crossSectionSubject: null,
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
      // Same schedule key Your Next Steps' overdue payment items use
      // (payment:{scheduleId}) — kept in sync even though today the two are
      // temporally exclusive (Upcoming is strictly future, Next Steps'
      // payment items are overdue/today-only), so the match is honest and
      // future-proof rather than a coincidence of the current date filter.
      crossSectionSubject: `payment:${payment.scheduleId}`,
    });
  }


  return items.sort((a, b) => (a.sortDate ?? "9999").localeCompare(b.sortDate ?? "9999"));
}

/**
 * Coming up is events only — the events table, real event dates, next 30 days.
 *
 * Payments, invoices, tours, tasks, and other dated facts are a different
 * domain. They must not be merged into this list (even when they belong to
 * the same client/event). Today's events stay in Today's Focus.
 */
export function classifyUpcomingItems(data: DashboardData): ClassifiedItem[] {
  const today = data.todayIso;
  const horizon = comingUpHorizonEnd(today);
  const items: ClassifiedItem[] = [];
  for (const event of data.upcomingEvents) {
    if (!event.eventDate) continue;
    if (event.eventDate <= today) continue;
    if (event.eventDate > horizon) continue;
    items.push({
      id: `up-event-${event.id}`,
      priority: "upcoming",
      domain: "Events",
      label: event.clientName ?? event.name,
      detail: "Event",
      href: `/events/${event.id}`,
      rightLabel: formatEventDate(event.eventDate),
      sortDate: event.eventDate,
      crossSectionSubject: null,
    });
  }
  return items.sort((a, b) => (a.sortDate ?? "9999").localeCompare(b.sortDate ?? "9999"));
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
