import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { leadDisplayName } from "@/lib/leads/constants";
import type { Lead } from "@/lib/leads/types";

export function FollowupsWidget({
  leads,
  todayIso,
}: {
  leads: Lead[];
  todayIso: string;
}) {
  void todayIso;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-warning-foreground" />
          Follow-ups Due Today
        </CardTitle>
        <CardDescription>
          Leads scheduled for follow-up today.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No follow-ups due today — you&apos;re all caught up. 🌿
          </p>
        ) : (
          <div className="divide-y divide-border">
            {leads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-start justify-between gap-4 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}
                  </p>
                  {lead.nextActionText && (
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.nextActionText}
                    </p>
                  )}
                </div>
                <div className="shrink-0 pt-0.5">
                  <LeadStatusBadge status={lead.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
