import Link from "next/link";

import { StatusCard } from "@/components/dashboard-system/status-card";
import type { StatusCardTier } from "@/components/dashboard-system/status-card";
import { resolveEmailFailureGuidance } from "@/lib/communication/email-failure-guidance";
import type { CommunicationHealth } from "@/lib/communication/health";
import { MESSAGE_STATUS_META } from "@/lib/communication/status-labels";
import { messageDestinationHref } from "@/lib/communication/message-destination";

const LEVEL_TIER: Record<CommunicationHealth["level"], StatusCardTier> = {
  excellent:       "healthy",
  attention:       "warning",
  action_required: "critical",
};

/**
 * Communication Trust Experience, Phase 2 — aggregate health card.
 *
 * Launch presentation defers this widget from Communication Health page;
 * component preserved (logic/data unchanged) for possible later re-enable.
 * Issue rows use a concise status label rather than full bounce prose.
 */
export function CommunicationHealthWidget({ health }: { health: CommunicationHealth }) {
  const failedLabel = MESSAGE_STATUS_META.failed.label;
  return (
    <StatusCard
      title="Communication"
      tier={LEVEL_TIER[health.level]}
      headline={health.headline}
      detail={health.detail}
      issues={health.issues.map((issue) => {
        const guidance = issue.channel === "email"
          ? resolveEmailFailureGuidance(issue.reason)
          : null;
        const concise = guidance
          ? `${failedLabel} — ${guidance.category === "invalid_recipient" || guidance.category === "permanent_bounce"
            ? "check the address"
            : guidance.category === "temporary_bounce" || guidance.category === "temporary_provider" || guidance.category === "rate_limit"
              ? "try again later"
              : "see conversation"}`
          : failedLabel;
        return {
          id: issue.id,
          href: messageDestinationHref({
            clientId: issue.clientId,
            leadId: issue.leadId,
            conversationId: issue.conversationId,
          }),
          label: (
            <span className="flex items-center gap-1.5" data-testid="health-issue-row">
              <span aria-hidden>{issue.channel === "sms" ? "📱" : "✉️"}</span>
              {concise}
            </span>
          ),
        };
      })}
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
