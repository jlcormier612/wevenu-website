import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Request } from "@/lib/requests/types";

/**
 * Booking Workspace Request summary (Wedding Workspace – Request
 * Experience, Phase 1, Requirement 6) — additive only, does not touch any
 * other Overview card. Reuses the same requests already fetched for this
 * event; no second data source.
 */
export function RequestSummaryCard({ requests }: { requests: Request[] }) {
  if (requests.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const waitingOnClient = requests.filter((r) => ["sent", "viewed", "in_progress"].includes(r.status));
  const submittedForReview = requests.filter((r) => ["submitted", "reviewed"].includes(r.status));
  const overdue = requests.filter((r) => r.dueDate && r.dueDate < today && !["completed", "cancelled"].includes(r.status));
  const recentlyCompleted = requests.filter((r) => r.status === "completed");

  const stats = [
    { label: "Waiting on Client", value: waitingOnClient.length },
    { label: "Submitted for Review", value: submittedForReview.length },
    { label: "Overdue", value: overdue.length },
    { label: "Recently Completed", value: recentlyCompleted.length },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Requests</CardTitle>
        <Link href="/requests" className="text-xs text-primary hover:underline">Open Request Dashboard →</Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <p className="text-xl font-semibold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
