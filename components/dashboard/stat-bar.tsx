import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Sparkles,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard/types";

type Stat = {
  icon: React.ElementType;
  count: number;
  label: string;
  href: string;
  tone: "urgent" | "action" | "info" | "positive";
};

function StatCard({ icon: Icon, count, label, href, tone }: Stat) {
  const toneClass = {
    urgent:   count > 0 ? "border-destructive/30 bg-destructive/5"  : "",
    action:   count > 0 ? "border-warning/30 bg-warning/5"          : "",
    info:     "",
    positive: count > 0 ? "border-primary/25 bg-primary/5"          : "",
  }[tone];

  const iconClass = {
    urgent:   count > 0 ? "bg-destructive/10 text-destructive"  : "bg-muted text-muted-foreground",
    action:   count > 0 ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground",
    info:     "bg-muted text-muted-foreground",
    positive: count > 0 ? "bg-primary/10 text-primary"           : "bg-muted text-muted-foreground",
  }[tone];

  const countClass = {
    urgent:   count > 0 ? "text-destructive"        : "text-heading",
    action:   count > 0 ? "text-warning-foreground" : "text-heading",
    info:     "text-heading",
    positive: count > 0 ? "text-primary"            : "text-heading",
  }[tone];

  return (
    <Link href={href} className="block">
      <Card className={cn("transition-shadow hover:shadow-md", toneClass)}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconClass)}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className={cn("text-2xl font-semibold leading-none", countClass)}>{count}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function StatBar({ data }: { data: DashboardData }) {
  const stats: Stat[] = [
    {
      icon: Sparkles,
      count: data.newLeadCount,
      label: "New inquiries",
      href: "/leads",
      tone: "positive",
    },
    {
      icon: AlertTriangle,
      count: data.needsAttention.length,
      label: "Needs attention",
      href: "/leads",
      tone: "urgent",
    },
    {
      icon: CalendarDays,
      count: data.followupsDue.length + data.upcomingTours.length,
      label: "Follow-ups & tours",
      href: "/leads",
      tone: "action",
    },
    {
      icon: CheckSquare,
      count: data.openTaskCount,
      label: "Open tasks",
      href: "/leads",
      tone: "info",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </div>
  );
}
