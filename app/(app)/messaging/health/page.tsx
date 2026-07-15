import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageSquare, Smartphone } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CommunicationHealthWidget } from "@/components/communication/communication-health-widget";
import { ReadinessChecklist } from "@/components/communication/readiness-checklist";
import { MessageTimelinePopover } from "@/components/messaging/message-timeline-popover";
import { getCommunicationDashboardData } from "@/lib/communication/dashboard";
import { getCommunicationReadiness } from "@/lib/communication/readiness";
import { MESSAGE_STATUS_META } from "@/lib/communication/status-labels";

export const metadata: Metadata = { title: "Communication Health" };

export default async function CommunicationHealthPage() {
  const [{ health, counts, history }, readiness] = await Promise.all([
    getCommunicationDashboardData(),
    getCommunicationReadiness(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-heading">Communication Health</h1>
        <p className="text-sm text-muted-foreground">Whether your emails and texts are actually reaching your leads and clients.</p>
      </div>

      {/* Overall Communication Health — a different question from the history below:
          "can I trust this today" vs. "what happened to this specific message." */}
      <CommunicationHealthWidget health={health} />

      {/* Plain counts, never a bare percentage — per the Trust Experience brief. */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold text-heading">{counts.sent}</p>
          <p className="text-xs text-muted-foreground mt-1">messages sent (last {counts.windowDays} days)</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold text-success">{counts.delivered}</p>
          <p className="text-xs text-muted-foreground mt-1">delivered successfully</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className={`text-2xl font-bold ${counts.needsAttention > 0 ? "text-destructive" : "text-heading"}`}>{counts.needsAttention}</p>
          <p className="text-xs text-muted-foreground mt-1">need{counts.needsAttention === 1 ? "s" : ""} your attention</p>
        </CardContent></Card>
      </div>

      {/* Communication Readiness — "before your first message," not a daily
          concern, so it sits below the health summary rather than above it. */}
      <ReadinessChecklist initial={readiness} />

      {/* Individual Message History — deliberately separate from the health
          summary above. */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-heading text-sm font-semibold text-heading">Message History</h2>
        </CardHeader>
        <CardContent className="pt-0">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((m) => {
                const href = m.clientId ? `/clients/${m.clientId}` : m.leadId ? `/leads/${m.leadId}` : null;
                const Icon = m.channel === "sms" ? Smartphone : Mail;
                const nameBlock = (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-heading">
                      {m.recipientName ?? (m.direction === "inbound" ? "Incoming message" : "Sent message")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.preview}</p>
                  </div>
                );
                return (
                  <li key={`${m.source}-${m.id}`} className="flex items-center gap-3 py-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    {href ? <Link href={href} className="flex min-w-0 flex-1 hover:text-primary">{nameBlock}</Link> : nameBlock}
                    {/* Outbound: click the status to see the Message Timeline —
                        when it was Created, Sent, Delivered, Opened, Clicked,
                        Replied. Inbound never had a send lifecycle to show. */}
                    <div className="shrink-0 text-right">
                      {m.direction === "outbound" ? (
                        <MessageTimelinePopover
                          messageId={m.id} source={m.source} status={m.status} failureReason={m.failureReason}
                          isOutbound
                        />
                      ) : m.status && MESSAGE_STATUS_META[m.status] ? (
                        <p className="text-xs font-medium text-muted-foreground">
                          <span aria-hidden>{MESSAGE_STATUS_META[m.status].emoji}</span> {MESSAGE_STATUS_META[m.status].label}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(m.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Link href="/messaging" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <MessageSquare className="h-3.5 w-3.5" /> Back to Inbox
      </Link>
    </div>
  );
}
