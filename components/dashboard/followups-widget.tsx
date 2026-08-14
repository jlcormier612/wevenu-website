import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { AttentionList } from "@/components/dashboard-system/attention-list";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { leadDisplayName } from "@/lib/leads/constants";
import type { Lead } from "@/lib/leads/types";

// Dashboard Component System, Phase 1 Step 2 — shell migrated to
// AttentionList; row content and copy unchanged.
export function FollowupsWidget({
  leads,
  todayIso,
}: {
  leads: Lead[];
  todayIso: string;
}) {
  void todayIso;
  return (
    <AttentionList
      icon={<CalendarClock className="h-4 w-4 text-warning-foreground" />}
      title="Follow-ups Due Today"
      description="Leads scheduled for follow-up today."
      items={leads}
      getKey={(lead) => lead.id}
      emptyState={
        <p className="py-6 text-center text-sm text-muted-foreground">
          No follow-ups due today — you&apos;re all caught up. 🌿
        </p>
      }
      renderRow={(lead) => (
        <Link
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
      )}
    />
  );
}
