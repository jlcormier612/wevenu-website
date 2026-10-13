import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatTile } from "@/components/dashboard-system/stat-tile";
import { CommunicationHealthWidget } from "@/components/communication/communication-health-widget";
import { ReadinessChecklist } from "@/components/communication/readiness-checklist";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { MessageHistoryList } from "@/components/messaging/message-history-list";
import { getCommunicationDashboardData } from "@/lib/communication/dashboard";
import { getCommunicationReadiness } from "@/lib/communication/readiness";
import { DASHBOARD_COUNT_NOTE } from "@/lib/communication/message-status-definitions";
import {
  attentionHistoryHref,
  attentionTileAriaLabel,
  isAttentionHistoryFilterActive,
} from "@/lib/communication/attention-history";

export const metadata: Metadata = { title: "Communication Health" };

type Props = {
  searchParams: Promise<{ attention?: string }>;
};

export default async function CommunicationHealthPage({ searchParams }: Props) {
  const params = await searchParams;
  const attentionOnly = isAttentionHistoryFilterActive(params.attention);

  const [{ health, counts, history }, readiness] = await Promise.all([
    getCommunicationDashboardData({ attentionOnly }),
    getCommunicationReadiness(),
  ]);

  const attentionHref = attentionHistoryHref(counts.needsAttention);
  const showAttentionFilter = attentionOnly && counts.needsAttention > 0;

  return (
    <div className="space-y-6">
      <CollectionBackLink href="/messaging" label="Inbox" />
      <div>
        <h1 className="font-heading text-2xl font-medium text-heading">Communication Health</h1>
        <p className="text-sm text-muted-foreground">Whether your emails and texts are actually reaching your leads and clients.</p>
        <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-heading">How to read this page</p>
          <p>If <span className="text-heading">texting setup</span> isn’t ready, finish it in Settings — that isn’t an HTC outage.</p>
          <p>If <span className="text-heading">some messages couldn’t be delivered</span>, open those conversations in Inbox to retry or switch channels.</p>
          <p>If many messages fail at once, contact support — that may be a broader delivery problem.</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Email is set up for Hello to Cheers as a platform. Texting is enabled per venue in{" "}
          <Link href="/settings/communications#texting" className="underline underline-offset-2 text-heading">Settings → Text messaging</Link>
          . Your venue contact email and phone are used for test messages and for how couples reach you.</p>
      </div>

      <CommunicationHealthWidget health={health} />

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6">
            <StatTile layout="value-top" align="center" value={counts.sent} label={`messages sent (last ${counts.windowDays} days)`} />
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <StatTile layout="value-top" align="center" value={counts.delivered} label="delivered successfully" valueClassName="text-success" />
          </CardContent></Card>
          <Card
            className={
              attentionHref
                ? "ring-offset-background transition-colors hover:border-destructive/40 focus-within:ring-2 focus-within:ring-ring"
                : undefined
            }
            data-testid="attention-stat-card"
          >
            <CardContent className="pt-6">
              <StatTile
                layout="value-top"
                align="center"
                value={counts.needsAttention}
                label={`need${counts.needsAttention === 1 ? "s" : ""} your attention`}
                valueClassName={counts.needsAttention > 0 ? "text-destructive" : "text-heading"}
                href={attentionHref ?? undefined}
                ariaLabel={attentionTileAriaLabel(counts.needsAttention)}
                active={showAttentionFilter}
              />
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">{DASHBOARD_COUNT_NOTE}</p>
      </div>

      <ReadinessChecklist initial={readiness} />

      <Card>
        <CardHeader className="pb-3 space-y-2">
          <h2 className="font-heading text-sm font-semibold text-heading">
            {showAttentionFilter ? "Messages that need your attention" : "Message History"}
          </h2>
          {showAttentionFilter && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <p>
                Showing delivery failures from the last {counts.windowDays} days
                ({history.length} of {counts.needsAttention} counted).
                Failed delivery is different from messages still waiting on confirmation.
              </p>
              <Link
                href="/messaging/health"
                className="font-medium text-heading underline underline-offset-2"
              >
                Clear filter
              </Link>
            </div>
          )}
          {attentionOnly && counts.needsAttention === 0 && (
            <p className="text-xs text-muted-foreground">
              No messages currently need attention.{" "}
              <Link href="/messaging/health" className="font-medium text-heading underline underline-offset-2">
                Back to Message History
              </Link>
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {attentionOnly && counts.needsAttention === 0 ? null : (
            <MessageHistoryList
              items={history}
              paginate={showAttentionFilter}
              pageSize={20}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
