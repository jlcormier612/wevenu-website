/**
 * Couple Home — What's Happening presentation.
 *
 * Filters / orders / caps the existing `get_recent_activity` payload for Home.
 * Does not invent event types or change the activity SoT / API.
 *
 * ## Existing event types (from `get_recent_activity` RPC)
 * - `guest_added` — aggregated guest-list additions this week
 * - `photo_uploaded` — couple media / inspiration / memory photo
 * - `todo_completed` — couple to-do completion (low-value; excluded on Home)
 * - `journal_entry` — planning journal (optional `source`: `manual` | `auto`)
 *
 * ## Last-visit note (deferred)
 * `client_portal_sessions.last_accessed_at` exists and is updated to `now()`
 * inside `get_portal_context` on every portal open — so by the time Home
 * renders it already reflects the current visit, not the prior one.
 * Keep calm "This week". Do not invent a previous-visit window without a
 * reliable prior timestamp (no new DB columns in this work package).
 */
import type { ActivityItem, PortalSection } from "@/lib/portal/types";

export const WHATS_HAPPENING_HOME_CAP = 5;

/**
 * No dedicated activity section exists in the portal shell.
 * Do not invent a destination or fake "View all activity" link.
 */
export const WHATS_HAPPENING_VIEW_ALL_DESTINATION: PortalSection | null = null;

export type HappeningActorKind = "venue" | "vendor" | "shared" | "couple" | "system";

export type HappeningItem = {
  /** Stable key for list rendering (type + occurredAt); not a DB id. */
  key: string;
  type: string;
  emoji: string;
  /** Warm human summary answering who + what. */
  summary: string;
  /** Screen-reader / accessible description. */
  description: string;
  occurredAt: string;
  whenLabel: string;
  destination: PortalSection | null;
  actorKind: HappeningActorKind;
};

export type HappeningSelection = {
  visible: HappeningItem[];
  totalMeaningful: number;
  hasMore: boolean;
  /** True only when a real activity destination exists (currently none). */
  showViewAll: boolean;
};

/** Priority bands: venue → vendor → shared → couple → low-value/system. */
const ACTOR_RANK: Record<HappeningActorKind, number> = {
  venue: 1,
  vendor: 2,
  shared: 3,
  couple: 4,
  system: 5,
};

function actorKindForType(type: string): HappeningActorKind {
  const t = type.toLowerCase();
  if (
    t.includes("venue") ||
    t.includes("message") ||
    t.includes("request") ||
    t.includes("timeline") ||
    t.includes("document") ||
    t.includes("contract")
  ) {
    return "venue";
  }
  if (t.includes("vendor")) return "vendor";
  if (
    t.includes("guest") ||
    t.includes("rsvp") ||
    t.includes("payment") ||
    t.includes("website")
  ) {
    return "shared";
  }
  if (t === "todo_completed") return "system";
  return "couple";
}

/** Exclude noise; never invent types — only suppress known low-value ones. */
export function isMeaningfulHappeningItem(item: ActivityItem): boolean {
  if (item.type === "todo_completed") return false;
  if (item.type === "journal_entry" && item.source === "auto") return false;
  const t = item.type.toLowerCase();
  if (t.includes("login") || t.includes("page_view") || t.includes("heartbeat")) return false;
  return true;
}

export function happeningDestination(type: string): PortalSection | null {
  const t = type.toLowerCase();
  if (t === "guest_added" || t.includes("guest") || t.includes("rsvp")) return "guests";
  if (t === "journal_entry" || t === "photo_uploaded") return "story";
  if (t === "todo_completed") return "todos";
  if (t.includes("message")) return "messages";
  if (t.includes("document") || t.includes("contract")) return "documents";
  if (t.includes("timeline") || t.includes("run_of_show")) return "timeline";
  if (t.includes("payment")) return "payments";
  if (t.includes("website")) return "website";
  return null;
}

/** Warm who+what summary from existing labels — no technical/db language. */
export function formatHappeningSummary(item: ActivityItem): string {
  const label = (item.label ?? "").trim();
  if (!label) return "Something happened with your wedding";

  switch (item.type) {
    case "guest_added":
      if (/^added\b/i.test(label)) return `You ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
      return label;
    case "photo_uploaded":
      if (/^(added|captured|saved)\b/i.test(label)) {
        return `You ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
      }
      return label;
    case "journal_entry":
      if (/^(wrote|added)\b/i.test(label)) {
        return `You ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
      }
      // Manual entries sometimes surface the title alone from the RPC.
      return label.startsWith("“") || label.startsWith('"')
        ? `You wrote about ${label}`
        : label;
    case "todo_completed":
      if (/^checked off\b/i.test(label)) {
        return `You ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
      }
      return label;
    default:
      return label;
  }
}

/**
 * Calm relative times for the stream.
 * Accepts optional `now` for deterministic tests.
 */
export function formatHappeningWhen(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const diffMs = now.getTime() - then.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 2) return "Just now";
  if (mins < 60) return mins === 1 ? "1 minute ago" : `${mins} minutes ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThen = new Date(then);
  startOfThen.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday.getTime() - startOfThen.getTime()) / 86_400_000);

  if (dayDiff === 1) return "Yesterday";
  if (dayDiff > 1 && dayDiff < 7) {
    return then.toLocaleDateString("en-US", { weekday: "long" });
  }
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toHappeningItem(item: ActivityItem, index: number, now: Date): HappeningItem {
  const summary = formatHappeningSummary(item);
  const whenLabel = formatHappeningWhen(item.occurredAt, now);
  const destination = happeningDestination(item.type);
  const actorKind = actorKindForType(item.type);
  return {
    key: `${item.type}-${item.occurredAt}-${index}`,
    type: item.type,
    emoji: item.emoji || "✦",
    summary,
    description: whenLabel ? `${summary}. ${whenLabel}.` : `${summary}.`,
    occurredAt: item.occurredAt,
    whenLabel,
    destination,
    actorKind,
  };
}

function compareHappening(a: HappeningItem, b: HappeningItem): number {
  const ra = ACTOR_RANK[a.actorKind];
  const rb = ACTOR_RANK[b.actorKind];
  if (ra !== rb) return ra - rb;
  // Newer first within the same band.
  return b.occurredAt.localeCompare(a.occurredAt);
}

/**
 * Select up to `cap` meaningful Home items.
 * Preserves source order uniqueness (no title-based dedupe).
 */
export function selectWhatsHappeningForHome(
  activity: ActivityItem[] | null | undefined,
  cap: number = WHATS_HAPPENING_HOME_CAP,
  now: Date = new Date(),
): HappeningSelection {
  const source = Array.isArray(activity) ? activity : [];
  const meaningful = source
    .filter(isMeaningfulHappeningItem)
    .map((item, index) => toHappeningItem(item, index, now))
    .sort(compareHappening);

  const visible = meaningful.slice(0, Math.max(0, cap));
  const hasMore = meaningful.length > visible.length;
  const showViewAll = hasMore && WHATS_HAPPENING_VIEW_ALL_DESTINATION != null;

  return {
    visible,
    totalMeaningful: meaningful.length,
    hasMore,
    showViewAll,
  };
}
