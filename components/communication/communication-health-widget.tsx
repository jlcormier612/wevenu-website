import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CommunicationHealth } from "@/lib/communication/health";

const LEVEL_META: Record<CommunicationHealth["level"], { emoji: string; borderColor: string; bgMix: string; textColor: string }> = {
  excellent:       { emoji: "🟢", borderColor: "border-success/25",     bgMix: "var(--success)",     textColor: "text-success" },
  attention:       { emoji: "🟡", borderColor: "border-warning/25",     bgMix: "var(--warning)",     textColor: "text-warning-foreground" },
  action_required: { emoji: "🔴", borderColor: "border-destructive/20", bgMix: "var(--destructive)", textColor: "text-destructive" },
};

function issueLink(issue: CommunicationHealth["issues"][number]): string | null {
  if (issue.clientId) return `/clients/${issue.clientId}`;
  if (issue.leadId) return `/leads/${issue.leadId}`;
  return null;
}

/**
 * Communication Trust Experience, Phase 2 — the one question a venue owner
 * actually has: "can I trust Wevenu to communicate with my clients today?"
 * No SPF/DKIM/webhook language here by design; see lib/communication/
 * health.ts for how the three states are computed.
 */
export function CommunicationHealthWidget({ health }: { health: CommunicationHealth }) {
  const meta = LEVEL_META[health.level];

  return (
    <Card
      className={meta.borderColor}
      style={{ background: `color-mix(in oklch, ${meta.bgMix} 3%, var(--card))` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span aria-hidden>{meta.emoji}</span>
            <h2 className="font-heading text-sm font-semibold text-heading">Communication</h2>
          </div>
          <span className={`text-xs font-semibold ${meta.textColor}`}>{health.headline}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground">{health.detail}</p>
        {health.issues.length > 0 && (
          <ul className="space-y-1.5">
            {health.issues.slice(0, 4).map((issue) => {
              const href = issueLink(issue);
              const content = (
                <span className="flex items-center gap-1.5">
                  <span aria-hidden>{issue.channel === "sms" ? "📱" : "✉️"}</span>
                  {issue.reason}
                </span>
              );
              return (
                <li key={issue.id} className="text-xs text-muted-foreground">
                  {href ? <Link href={href} className="hover:text-foreground hover:underline">{content}</Link> : content}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
