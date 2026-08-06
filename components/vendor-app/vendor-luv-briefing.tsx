/**
 * Vendor Luv briefing — same job and visual cues as the venue Daily Briefing
 * ("Today's Briefing" / LuvHeart / dusty rose), role-scoped to vendor ops.
 *
 * Presentation layer only: sections mirror DailyBriefingWidget so Luv feels
 * like one character across portals.
 */
"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Info } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import type { BriefingItem, LuvBriefing } from "@/lib/luv/briefing-types";

const DUSTY_ROSE = "#D8A7AA";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function Row({ item, icon: Icon, tone }: { item: BriefingItem; icon: React.ElementType; tone: string }) {
  return (
    <Link
      href={item.link}
      className="flex items-start gap-2.5 rounded-sm px-2 py-1.5 -mx-2 hover:bg-muted/50 transition-colors"
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
  );
}

function Section({
  title,
  items,
  icon,
  tone,
  emptyText,
}: {
  title: string;
  items: BriefingItem[];
  icon: React.ElementType;
  tone: string;
  emptyText?: string;
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
            <Row key={item.id} item={item} icon={icon} tone={tone} />
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
  const totalUrgent = briefing.needsAttentionNow.length;
  const hasAnything =
    briefing.needsAttentionNow.length > 0 ||
    briefing.comingUpThisWeek.length > 0 ||
    briefing.resolvedSinceLastLooked.length > 0 ||
    briefing.informational.length > 0;

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
          <h2 className="font-heading text-sm font-semibold text-heading">Today&apos;s Briefing</h2>
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
              items={briefing.needsAttentionNow}
              icon={AlertTriangle}
              tone="text-destructive"
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
