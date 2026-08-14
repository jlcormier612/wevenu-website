import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Sparkles,
} from "lucide-react";

import { StatTile, StatTileGrid } from "@/components/dashboard-system/stat-tile";
import type { Severity } from "@/lib/dashboard-system/severity";
import type { DashboardData } from "@/lib/dashboard/types";

type Stat = {
  icon: React.ElementType;
  count: number;
  label: string;
  href: string;
  severity?: Severity;
};

// Dashboard Component System, Phase 1 Step 3 (docs/dashboard-component-
// system-architecture.md §2.1) — StatBar is now a thin composition of the
// canonical StatTile; the old per-tone color logic (previously duplicated
// here) now lives once in lib/dashboard-system/severity.ts. Tone mapping
// preserved exactly: urgent->critical, action->warning, positive->opportunity,
// info->no severity (neutral tile).
export function StatBar({ data }: { data: DashboardData }) {
  const stats: Stat[] = [
    {
      icon: Sparkles,
      count: data.newLeadCount,
      label: "New inquiries",
      href: "/leads",
      severity: "opportunity",
    },
    {
      icon: AlertTriangle,
      count: data.needsAttention.length,
      label: "Needs attention",
      href: "/leads",
      severity: "critical",
    },
    {
      icon: CalendarDays,
      count: data.followupsDue.length + data.upcomingTours.length,
      label: "Follow-ups & tours",
      href: "/leads",
      severity: "warning",
    },
    {
      icon: CheckSquare,
      count: data.openTaskCount,
      label: "Open tasks",
      href: "/leads",
    },
  ];

  return (
    <StatTileGrid>
      {stats.map((s) => (
        <StatTile key={s.label} icon={s.icon} value={s.count} label={s.label} href={s.href} severity={s.severity} />
      ))}
    </StatTileGrid>
  );
}
