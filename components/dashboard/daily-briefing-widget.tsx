/**
 * Daily Briefing — Luv Success Guide §3.1 (2026-07-22). A thin
 * presentation layer over lib/luv/briefing-service.ts's getDailyBriefing()
 * — no logic lives here, only rendering of the four already-computed
 * sections in the design doc's fixed priority order.
 */
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Info } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import type { BriefingItem, LuvBriefing } from "@/lib/luv/briefing-types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Row({ item, icon: Icon, tone }: { item: BriefingItem; icon: React.ElementType; tone: string }) {
  return (
    <Link
      href={item.link}
      className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 -mx-2 hover:bg-muted/50 transition-colors"
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${tone}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-heading truncate">{item.detail}</p>
        {(item.eventName || item.eventDate) && (
          <p className="text-xs text-muted-foreground">
            {item.eventName}{item.eventName && item.eventDate ? " · " : ""}{formatDate(item.eventDate)}
          </p>
        )}
      </div>
    </Link>
  );
}

function Section({ title, items, icon, tone, emptyText }: {
  title: string; items: BriefingItem[]; icon: React.ElementType; tone: string; emptyText?: string;
}) {
  if (items.length === 0 && !emptyText) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}{items.length > 0 ? ` (${items.length})` : ""}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 px-2 py-1">{emptyText}</p>
      ) : (
        <div className="space-y-0.5">
          {items.slice(0, 6).map((item) => <Row key={item.id} item={item} icon={icon} tone={tone} />)}
        </div>
      )}
    </div>
  );
}

export function DailyBriefingWidget({ briefing }: { briefing: LuvBriefing }) {
  const totalUrgent = briefing.needsAttentionNow.length;
  const hasAnything =
    briefing.needsAttentionNow.length > 0 ||
    briefing.comingUpThisWeek.length > 0 ||
    briefing.resolvedSinceLastLooked.length > 0 ||
    briefing.informational.length > 0;

  if (!hasAnything) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <LuvHeart size={16} />
          <h2 className="font-heading text-sm font-semibold text-heading">Today&apos;s Briefing</h2>
          {totalUrgent > 0 && (
            <span className="ml-auto text-xs font-semibold text-destructive">{totalUrgent} need{totalUrgent === 1 ? "s" : ""} attention</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
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
        {briefing.resolvedSinceLastLooked.length > 0 && (
          <Section
            title="Resolved since you last looked"
            items={briefing.resolvedSinceLastLooked}
            icon={CheckCircle2}
            tone="text-success"
          />
        )}
        {briefing.informational.length > 0 && (
          <Section
            title="Also worth knowing"
            items={briefing.informational}
            icon={Info}
            tone="text-muted-foreground"
          />
        )}
      </CardContent>
    </Card>
  );
}
