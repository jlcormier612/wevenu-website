/**
 * Vendor Luv briefing — same job and visual cues as the venue Daily Briefing
 * ("Today's Briefing" / LuvHeart / dusty rose), role-scoped to vendor ops.
 *
 * Presentation layer only: sections mirror DailyBriefingWidget so Luv feels
 * like one character across portals.
 *
 * Notification-backed Needs-you-now rows can be soft-dismissed (mark read);
 * hard clear remains on the notification bell.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, Info, X } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import type { BriefingItem, LuvBriefing } from "@/lib/luv/briefing-types";

const DUSTY_ROSE = "#D8A7AA";

async function markVendorNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  try {
    await fetch("/api/vendor/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  } catch {
    // never crash the briefing over a failed ack
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function Row({
  item,
  icon: Icon,
  tone,
  onDismiss,
}: {
  item: BriefingItem;
  icon: React.ElementType;
  tone: string;
  onDismiss?: (item: BriefingItem) => void;
}) {
  const dismissIds = item.dismissNotificationIds ?? [];
  const canDismiss = dismissIds.length > 0 && onDismiss;

  return (
    <div className="group relative flex items-start gap-1 rounded-sm -mx-2 hover:bg-muted/50 transition-colors">
      <Link
        href={item.link}
        className="flex min-w-0 flex-1 items-start gap-2.5 px-2 py-1.5"
        onClick={() => {
          if (dismissIds.length > 0) void markVendorNotificationsRead(dismissIds);
        }}
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${tone}`} />
        <div className="min-w-0 flex-1">
          {/* Primary line is the actionable "what" — never truncate mid-reason. */}
          <p className="text-sm text-heading line-clamp-2">{item.detail}</p>
          {(item.eventName || item.eventDate) && (
            <p className="text-xs text-muted-foreground truncate">
              {item.eventName}
              {item.eventName && item.eventDate ? " · " : ""}
              {formatDate(item.eventDate)}
            </p>
          )}
        </div>
      </Link>
      {canDismiss && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss(item);
          }}
          className="mr-1 mt-1.5 shrink-0 rounded p-1 text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 sm:opacity-100"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  icon,
  tone,
  emptyText,
  onDismiss,
}: {
  title: string;
  items: BriefingItem[];
  icon: React.ElementType;
  tone: string;
  emptyText?: string;
  onDismiss?: (item: BriefingItem) => void;
}) {
  if (items.length === 0 && !emptyText) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {items.length > 0 ? ` (${items.length})` : ""}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 px-2 py-1">{emptyText}</p>
      ) : (
        <div className="space-y-0.5">
          {items.slice(0, 8).map((item) => (
            <Row key={item.id} item={item} icon={icon} tone={tone} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

export function VendorLuvBriefing({
  briefing,
  isPrimarySurface = false,
  compact = false,
}: {
  briefing: LuvBriefing;
  /**
   * True on /vendor/luv — always show a light reassurance empty state
   * (same rule as venue Luv primary surfaces). False when embedded on Home.
   */
  isPrimarySurface?: boolean;
  /** Home embed: show urgent + coming up only, with link to full Luv page. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = React.useState<string[]>([]);

  const visibleNeeds = briefing.needsAttentionNow.filter((i) => !hiddenIds.includes(i.id));
  const totalUrgent = visibleNeeds.length;
  const hasAnything =
    visibleNeeds.length > 0 ||
    briefing.comingUpThisWeek.length > 0 ||
    briefing.resolvedSinceLastLooked.length > 0 ||
    briefing.informational.length > 0;

  function handleDismiss(item: BriefingItem) {
    const ids = item.dismissNotificationIds ?? [];
    setHiddenIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    void markVendorNotificationsRead(ids).then(() => router.refresh());
  }

  if (!hasAnything && !isPrimarySurface) return null;

  const empty = !hasAnything;

  return (
    <Card
      className="w-full border-[#D8A7AA]/25"
      style={{ background: `color-mix(in oklch, ${DUSTY_ROSE} 4%, var(--card))` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <LuvHeart size={16} />
          <h2 className="font-heading text-sm font-semibold text-heading">Today&apos;s briefing</h2>
          {totalUrgent > 0 && (
            <span className="ml-auto text-xs font-semibold text-destructive">
              {totalUrgent} need{totalUrgent === 1 ? "s" : ""} attention
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Luv is keeping an eye on what matters for your events.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {empty ? (
          <div className="flex items-center gap-2 py-2">
            <LuvHeart size={14} />
            <p className="text-sm text-muted-foreground">
              Everything looks good today — nothing needs your attention right now.
            </p>
          </div>
        ) : (
          <>
            <Section
              title="Needs you now"
              items={visibleNeeds}
              icon={AlertTriangle}
              tone="text-destructive"
              onDismiss={handleDismiss}
            />
            <Section
              title="Coming up this week"
              items={briefing.comingUpThisWeek}
              icon={CalendarClock}
              tone="text-muted-foreground"
            />
            {!compact && briefing.resolvedSinceLastLooked.length > 0 && (
              <Section
                title="Resolved since you last looked"
                items={briefing.resolvedSinceLastLooked}
                icon={CheckCircle2}
                tone="text-success"
              />
            )}
            <Section
              title="Worth knowing"
              items={compact ? briefing.informational.slice(0, 2) : briefing.informational}
              icon={Info}
              tone="text-muted-foreground"
            />
          </>
        )}

        {compact && hasAnything && (
          <Link
            href="/vendor/luv"
            className="inline-flex text-xs font-medium text-primary hover:underline underline-offset-2"
          >
            Open full briefing →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
