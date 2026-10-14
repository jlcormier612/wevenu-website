import Link from "next/link";

import { StatusCard } from "@/components/dashboard-system/status-card";
import type { StatusCardTier } from "@/components/dashboard-system/status-card";
import type { CommunicationHealth } from "@/lib/communication/health";
import { messageDestinationHref } from "@/lib/communication/message-destination";

const LEVEL_TIER: Record<CommunicationHealth["level"], StatusCardTier> = {
  excellent:       "healthy",
  attention:       "warning",
  action_required: "critical",
};

/**
 * Communication Trust Experience, Phase 2 — the one question a venue owner
 * actually has: "can I trust Hello to Cheers to communicate with my clients today?"
 * No SPF/DKIM/webhook language here by design; see lib/communication/
 * health.ts for how the three states are computed.
 *
 * Dashboard Component System, Phase 2 — shell migrated to the canonical
 * StatusCard; copy/behavior unchanged.
 */
export function CommunicationHealthWidget({ health }: { health: CommunicationHealth }) {
  return (
    <StatusCard
      title="Communication"
      tier={LEVEL_TIER[health.level]}
      headline={health.headline}
      detail={health.detail}
      issues={health.issues.map((issue) => ({
        id: issue.id,
        href: messageDestinationHref({
          clientId: issue.clientId,
          leadId: issue.leadId,
          conversationId: issue.conversationId,
        }),
        label: (
          <span className="flex items-center gap-1.5">
            <span aria-hidden>{issue.channel === "sms" ? "📱" : "✉️"}</span>
            {issue.reason}
          </span>
        ),
      }))}
      renderIssueLink={(issue, content) =>
        issue.href ? (
          <Link href={issue.href} className="hover:text-foreground hover:underline">
            {content}
          </Link>
        ) : (
          content
        )
      }
    />
  );
}
