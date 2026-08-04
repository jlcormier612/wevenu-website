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

  // ── Needs you now ────────────────────────────────────────────────────────
  for (const c of home.unreadConversations) {
    needsAttentionNow.push({
      id: `msg-${c.conversationId}`,
      eventId: c.eventId,
      eventName: c.eventName,
      eventDate: c.eventDate,
      label: "Unread message",
      detail:
        c.contactUnread === 1
          ? "1 message waiting for your reply"
          : `${c.contactUnread} messages waiting for your reply`,
      link: `/vendor/messages/${c.conversationId}`,
    });
  }

  for (const t of home.tasksDue) {
    const overdue = t.dueDate != null && t.dueDate < today;
    needsAttentionNow.push({
      id: `task-${t.id}`,
      eventId: t.eventId,
      eventName: null,
      eventDate: t.dueDate,
      label: overdue ? "Overdue task" : "Task due soon",
      detail: t.title,
      link: `/vendor/tasks?focus=${encodeURIComponent(t.id)}`,
    });
  }

  for (const ev of home.eventsToday) {
    needsAttentionNow.push({
      id: `event-today-${ev.assignmentId}`,
      eventId: ev.eventId,
      eventName: ev.eventName,
      eventDate: ev.eventDate,
      label: "Event today",
      detail: ev.arrivalTime
        ? `Check in with ${ev.venueName} — arrival ${ev.arrivalTime}`
        : `You're on site with ${ev.venueName} today`,
      link: `/vendor/events/${ev.assignmentId}`,
    });
  }

  // Unread vendor_notifications (light — not a full bell feed)
  if (extras?.notifications?.length) {
    needsAttentionNow.push(...extras.notifications);
  }

  // ── Coming up this week ──────────────────────────────────────────────────
  for (const ev of home.eventsThisWeek) {
    comingUpThisWeek.push({
      id: `event-week-${ev.assignmentId}`,
      eventId: ev.eventId,
      eventName: ev.eventName,
      eventDate: ev.eventDate,
      label: "Upcoming event",
      detail: ev.venueName
        ? `${ev.venueName}${ev.eventDate ? ` · ${formatShortDate(ev.eventDate)}` : ""}`
        : formatShortDate(ev.eventDate),
      link: `/vendor/events/${ev.assignmentId}`,
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
      eventName: tl.eventName,
      eventDate: tl.eventDate,
      label: "Run of show",
      detail: first.time ? `${first.time} · ${first.title}` : first.title,
      link: "/vendor/timeline",
    });
  }

  for (const doc of home.recentDocuments) {
    const count = doc.documents.length + doc.floorPlans.length;
    if (count === 0) continue;
    informational.push({
      id: `docs-${doc.assignmentId}`,
      eventId: doc.eventId,
      eventName: doc.eventName,
      eventDate: doc.eventDate,
      label: "Shared documents",
      detail:
        count === 1
          ? "1 file shared for this event"
          : `${count} files shared for this event`,
      link: `/vendor/events/${doc.assignmentId}`,
    });
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
          detail: "Your certificate of insurance has expired — venues typically need a current copy on file.",
          link: "/vendor/profile",
        });
      } else if (daysLeft <= 30) {
        informational.push({
          id: "coi-expiring",
          eventId: null,
          eventName: null,
          eventDate: profile.insuranceExpiry,
          label: "Insurance",
          detail: `Your certificate of insurance expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
          link: "/vendor/profile",
        });
      }
    } else {
      informational.push({
        id: "coi-missing",
        eventId: null,
        eventName: null,
        eventDate: null,
        label: "Insurance",
        detail: "No insurance expiry on file yet — venues often ask for this before load-in.",
        link: "/vendor/profile",
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
        detail: "A few profile details are still open — completing them helps venues work with you smoothly.",
        link: "/vendor/profile",
      });
    }
  }

  return {
    needsAttentionNow,
    comingUpThisWeek,
    resolvedSinceLastLooked: [],
    informational,
    generatedAt: new Date().toISOString(),
  };
}

/** Count of items that typically badge as "needs attention." */
export function getVendorLuvAttentionCount(briefing: LuvBriefing): number {
  return briefing.needsAttentionNow.length;
}
