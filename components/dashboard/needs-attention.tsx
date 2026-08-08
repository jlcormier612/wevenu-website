import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { AttentionList } from "@/components/dashboard-system/attention-list";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  eventTypeLabel,
  formatDate,
  leadDisplayName,
} from "@/lib/leads/constants";
import type { AttentionLead } from "@/lib/dashboard/types";

// Dashboard Component System, Phase 1 Step 2 (docs/dashboard-component-
// system-architecture.md §2.2) — shell migrated to the canonical
// AttentionList; row content and copy unchanged.
export function NeedsAttentionWidget({
  leads,
}: {
  leads: AttentionLead[];
}) {
  return (
    <AttentionList
      icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
      title="Needs Attention"
      description="Leads at risk of being dropped — overdue follow-ups and unworked new inquiries."
      headerRight={leads.length > 0 && <Badge variant="destructive">{leads.length}</Badge>}
      items={leads}
      getKey={(lead) => lead.id}
      emptyState={
        <div className="flex flex-col items-center py-6 text-center">
          <p className="text-sm font-medium text-heading">You&apos;re all caught up</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No leads need immediate attention right now.
          </p>
        </div>
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
            <p className="text-xs text-muted-foreground">
              {[eventTypeLabel(lead.eventType), formatDate(lead.eventDate)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-xs font-medium text-destructive">{lead.reason}</p>
          </div>
          <div className="shrink-0 pt-0.5">
            <LeadStatusBadge status={lead.status} />
          </div>
        </Link>
      )}
    />
  );
}
