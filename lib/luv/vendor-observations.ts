/**
 * Luv — vendor-facing observations.
 *
 * Same purpose as every other portal: notice what needs attention in *this*
 * role's world today, and point to the next useful action. Vendor-scoped
 * facts only (messages, tasks, events, docs, COI/profile) — not venue CRM
 * pipeline / marketplace health.
 *
 * Output shape is the shared Daily Briefing contract (`LuvBriefing` /
 * `BriefingItem` from lib/luv/briefing-types.ts) so vendor Luv and venue
 * Luv stay the same job with different feeds.
 *
 * Tone: professional hospitality — warm, service-oriented, states what's
 * true and what it means. Never a bare command or cheerleader copy.
 *
 * Each Needs-you-now row must answer: what, for whom, what to do — detail
 * carries the what/action; eventName · date carries the whom.
 */
import type { BriefingItem, LuvBriefing } from "@/lib/luv/briefing-types";
import type { VendorHomeData } from "@/lib/vendor-home/service";
import type { VendorProfile } from "@/lib/vendors/types";

export type VendorLuvProfileSlice = Pick<
  VendorProfile,
  | "businessName"
  | "contactName"
  | "category"
  | "description"
  | "email"
  | "phone"
  | "pricingTier"
  | "serviceArea"
  | "insuranceExpiry"
>;

/**
 * Optional feeds merged into the briefing. `notifications` is filled from
 * unread vendor_notifications (assignment / document alerts + rollup).
 * Couple↔vendor chat extras can land here later.
 */
export type VendorLuvExtras = {
  notifications?: BriefingItem[];
};

export type VendorLuvInput = {
  home: VendorHomeData;
  profile: VendorLuvProfileSlice | null;
  extras?: VendorLuvExtras;
};

function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function eventWhom(eventName: string | null | undefined, venueName: string | null | undefined): string | null {
  const parts = [eventName?.trim(), venueName?.trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Build the shared Daily Briefing sections from vendor operator data.
 * Pure — no I/O. Callers fetch VendorHomeData + profile first.
 */
export function getVendorBriefing(input: VendorLuvInput): LuvBriefing {
  const { home, profile, extras } = input;
  const needsAttentionNow: BriefingItem[] = [];
  const comingUpThisWeek: BriefingItem[] = [];
  const informational: BriefingItem[] = [];
  const today = todayIso();

  const eventById = new Map(home.allEvents.map((e) => [e.eventId, e]));

  // ── Needs you now ────────────────────────────────────────────────────────
  for (const c of home.unreadConversations) {
    const from =
      c.counterpartyLabel === "Venue"
        ? (c.venueName?.trim() || "the venue")
        : (c.coupleName?.trim() || "the couple");
    needsAttentionNow.push({
      id: `msg-${c.conversationId}`,
      eventId: c.eventId,
      eventName: eventWhom(c.eventName, c.venueName),
      eventDate: c.eventDate,
      label: "Unread message",
      detail:
        c.contactUnread === 1
          ? `1 unread message from ${from}`
          : `${c.contactUnread} unread messages from ${from}`,
      link: `/vendor/messages/${c.conversationId}`,
    });
  }

  for (const t of home.tasksDue) {
    const overdue = t.dueDate != null && t.dueDate < today;
    const ev = t.eventId ? eventById.get(t.eventId) : undefined;
    const taskLink = ev
      ? `/vendor/events/${ev.assignmentId}?tab=tasks&focus=${encodeURIComponent(t.id)}`
      : "/vendor/events";
    needsAttentionNow.push({
      id: `task-${t.id}`,
      eventId: t.eventId,
      eventName: ev ? eventWhom(ev.eventName, ev.venueName) : null,
      eventDate: t.dueDate,
      label: overdue ? "Overdue task" : "Task due soon",
      detail: overdue ? `Task overdue: ${t.title}` : `Task due soon: ${t.title}`,
      link: taskLink,
    });
  }

  for (const ev of home.eventsToday) {
    needsAttentionNow.push({
      id: `event-today-${ev.assignmentId}`,
      eventId: ev.eventId,
      eventName: eventWhom(ev.eventName, ev.venueName),
      eventDate: ev.eventDate,
      label: "Event today",
      detail: ev.arrivalTime
        ? `Event today — check in (arrival ${ev.arrivalTime})`
        : "Event today — check in",
      link: `/vendor/events/${ev.assignmentId}?tab=overview&highlight=checkin`,
    });
  }

  // ── Coming up this week ──────────────────────────────────────────────────
  for (const ev of home.eventsThisWeek) {
    comingUpThisWeek.push({
      id: `event-week-${ev.assignmentId}`,
      eventId: ev.eventId,
      eventName: eventWhom(ev.eventName, ev.venueName),
      eventDate: ev.eventDate,
      label: "Upcoming event",
      detail: ev.eventDate
        ? `Event this week — ${formatShortDate(ev.eventDate)}`
        : "Event this week",
      link: `/vendor/events/${ev.assignmentId}?tab=overview`,
    });
  }

  for (const tl of home.nextTimeline) {
    const first = tl.entries[0];
    if (!first) continue;
    // Avoid doubling events already listed from eventsThisWeek / today
    const already =
      comingUpThisWeek.some((i) => i.eventId === tl.eventId) ||
      needsAttentionNow.some((i) => i.eventId === tl.eventId && i.label === "Event today");
    if (already) continue;
    comingUpThisWeek.push({
      id: `timeline-${tl.assignmentId}`,
      eventId: tl.eventId,
      eventName: eventWhom(tl.eventName, tl.venueName),
      eventDate: tl.eventDate,
      label: "Timeline",
      detail: first.time
        ? `Next on the Timeline: ${first.time} · ${first.title}`
        : `Next on the Timeline: ${first.title}`,
      link: `/vendor/events/${tl.assignmentId}?tab=timeline`,
    });
  }

  // Unread vendor_notifications after home rows exist, so we can skip
  // duplicates (assignment when event is today).
  if (extras?.notifications?.length) {
    const eventTodayIds = new Set(
      needsAttentionNow
        .filter((i) => i.id.startsWith("event-today-"))
        .map((i) => i.eventId)
        .filter(Boolean),
    );

    for (const n of extras.notifications) {
      if (n.label === "New assignment" && n.eventId && eventTodayIds.has(n.eventId)) continue;
      needsAttentionNow.push(n);
    }
  }

  // ── Profile / COI (informational readiness — same Luv job, lighter urgency) ─
  if (profile) {
    const now = new Date();
    if (profile.insuranceExpiry) {
      const daysLeft = Math.ceil(
        (new Date(profile.insuranceExpiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysLeft <= 0) {
        needsAttentionNow.push({
          id: "coi-expired",
          eventId: null,
          eventName: null,
          eventDate: profile.insuranceExpiry,
          label: "Insurance",
          detail: "COI expired — update insurance on your profile",
          link: "/vendor/profile#insurance",
        });
      } else if (daysLeft <= 30) {
        informational.push({
          id: "coi-expiring",
          eventId: null,
          eventName: null,
          eventDate: profile.insuranceExpiry,
          label: "Insurance",
          detail: `COI expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — update before load-in`,
          link: "/vendor/profile#insurance",
        });
      }
    } else {
      informational.push({
        id: "coi-missing",
        eventId: null,
        eventName: null,
        eventDate: null,
        label: "Insurance",
        detail: "No COI on file yet — venues often ask before load-in",
        link: "/vendor/profile#insurance",
      });
    }

    const profileFields = [
      profile.businessName,
      profile.category,
      profile.description,
      profile.contactName,
      profile.email,
      profile.phone,
      profile.pricingTier,
      profile.serviceArea,
    ];
    const filled = profileFields.filter(Boolean).length;
    if (filled < 6) {
      informational.push({
        id: "profile-incomplete",
        eventId: null,
        eventName: null,
        eventDate: null,
        label: "Profile",
        detail: "A few profile details are still open — completing them helps venues work with you",
        link: "/vendor/profile",
      });
    }
  }

  // Final pass: collapse any remaining identical detail+eventName pairs
  // (e.g. two same-type alerts that slipped past earlier grouping).
  const dedupedNeeds = dedupeIndistinguishable(needsAttentionNow);

  return {
    needsAttentionNow: dedupedNeeds,
    comingUpThisWeek,
    resolvedSinceLastLooked: [],
    informational,
    generatedAt: new Date().toISOString(),
  };
}

/** Drop rows that would look identical in the briefing UI. Keep the first. */
function dedupeIndistinguishable(items: BriefingItem[]): BriefingItem[] {
  const seen = new Set<string>();
  const out: BriefingItem[] = [];
  for (const item of items) {
    const key = `${item.detail}::${item.eventName ?? ""}::${item.eventDate ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Count of items that typically badge as "needs attention." */
export function getVendorLuvAttentionCount(briefing: LuvBriefing): number {
  return briefing.needsAttentionNow.length;
}
