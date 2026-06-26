import Link from "next/link";

import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PipelineStage } from "@/lib/dashboard/types";
import type { LeadStatus } from "@/lib/leads/types";

export function PipelineSnapshot({
  stages,
  totalLeads,
}: {
  stages: PipelineStage[];
  totalLeads: number;
}) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline</CardTitle>
        <CardDescription>
          {totalLeads} lead{totalLeads !== 1 ? "s" : ""} total
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stages.map((stage) => (
            <Link
              key={stage.status}
              href="/leads"
              className="group flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted/40 transition-colors -mx-1.5"
            >
              <div className="w-28 shrink-0">
                <LeadStatusBadge status={stage.status as LeadStatus} />
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1 overflow-hidden rounded-full bg-muted h-2">
                  <div
                    className="h-2 rounded-full bg-primary/60 transition-all"
                    style={{
                      width: stage.count === 0
                        ? "0%"
                        : `${Math.max(8, Math.round((stage.count / maxCount) * 100))}%`,
                    }}
                  />
                </div>
                <span className="w-5 shrink-0 text-right text-sm font-medium text-foreground">
                  {stage.count}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
