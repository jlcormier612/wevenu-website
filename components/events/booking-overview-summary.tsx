import type { ReactNode } from "react";

import Link from "next/link";

import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/events/constants";
import { eventTypeLabel } from "@/lib/leads/constants";
import type { ClientStatus } from "@/lib/clients/types";
import type { EventReadiness } from "@/lib/playbooks/types";
import type { Invoice } from "@/lib/invoices/types";
import { formatCurrency } from "@/lib/invoices/constants";
import type { TimelineEntry } from "@/lib/timeline/types";
import type { EventVendorAssignment } from "@/lib/vendors/types";
import type { EventVendorRecommendation } from "@/lib/vendor-recommendations/types";
import type { ConversationMessage } from "@/lib/conversations/types";
import type { ThreadWithMessages } from "@/lib/messaging/types";
import type { Document } from "@/lib/documents/types";

// ---- Small shared tile ------------------------------------------------------

function SummaryTile({
  title, lines, linkHref, linkLabel,
}: {
  title: string;
  lines: ReactNode[];
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {lines.map((line, i) => <p key={i} className="text-sm text-foreground">{line}</p>)}
        <Link href={linkHref} className="inline-block pt-1 text-xs font-medium text-primary hover:underline">
          {linkLabel} →
        </Link>
      </CardContent>
    </Card>
  );
}

// ---- Planning progress (reused readiness data, same shape PlaybookApplyRow already uses) --

function readinessLine(readiness: EventReadiness | null): ReactNode {
  if (!readiness) return <span className="text-muted-foreground">Not started</span>;
  return `${readiness.score}% · ${readiness.completedRequired} of ${readiness.totalRequired} tasks`;
}

// ---- Main ---------------------------------------------------------------------

export function BookingOverviewSummary({
  clientName, eventType, eventDate, spaceName, guestCount, clientStatus,
  readinessByKind,
  invoices,
  timeline,
  vendorAssignments, vendorRecommendations,
  conversationExperienceEnabled, conversationMessages, threads,
  documents,
}: {
  clientName: string | null;
  eventType: string | null;
  eventDate: string;
  spaceName: string | null;
  guestCount: number | null;
  clientStatus: ClientStatus;
  readinessByKind: { client: EventReadiness | null; venue: EventReadiness | null };
  invoices: Invoice[];
  timeline: TimelineEntry[];
  vendorAssignments: EventVendorAssignment[];
  vendorRecommendations: EventVendorRecommendation[];
  conversationExperienceEnabled: boolean;
  conversationMessages: ConversationMessage[];
  threads: ThreadWithMessages[];
  documents: Document[];
}) {
  // ---- Payments: simple sums/finds over already-fetched invoices, nothing new invented ----
  const balanceDue = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
  const nextDue = invoices
    .filter((inv) => inv.balanceDue > 0 && inv.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0]?.dueDate ?? null;

  // ---- Timeline: created = any entries exist; last updated = latest updatedAt ----
  const timelineCreated = timeline.length > 0;
  const timelineLastUpdated = timeline.length > 0
    ? timeline.reduce((latest, e) => (e.updatedAt > latest ? e.updatedAt : latest), timeline[0].updatedAt)
    : null;

  // ---- Vendors ----
  const vendorsSelected = vendorAssignments.length;
  const recommendationsPending = vendorRecommendations.filter((r) => !r.selectedAt).length;

  // ---- Messages: real unread count only where Conversations tracks it (venueReadAt);
  // legacy threads have no read-state, so "unread" isn't shown for that path rather
  // than inventing one. ----
  const lastConversationMessage = conversationExperienceEnabled
    ? [...conversationMessages].sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))[0]
    : null;
  const conversationUnread = conversationExperienceEnabled
    ? conversationMessages.filter((m) => m.senderType === "lead_or_client" && !m.venueReadAt).length
    : 0;
  const lastThread = !conversationExperienceEnabled
    ? [...threads].sort((a, b) => (a.lastMessageAt ?? "") < (b.lastMessageAt ?? "") ? 1 : -1)[0]
    : null;

  return (
    <div className="space-y-4">
      {/* ── Top identity strip ──────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4 text-sm">
          <span className="font-medium text-heading">{clientName ?? "—"}</span>
          {eventType && <Badge variant="outline">{eventTypeLabel(eventType)}</Badge>}
          <span className="text-muted-foreground">{formatDate(eventDate)}</span>
          <span className="text-muted-foreground">{spaceName ?? "No space assigned"}</span>
          <span className="text-muted-foreground">
            {guestCount != null ? `${guestCount.toLocaleString()} guests` : "Guest count TBD"}
          </span>
          <ClientStatusBadge status={clientStatus} />
        </CardContent>
      </Card>

      {/* ── Summary tiles ────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryTile
          title="Planning"
          lines={[
            <>Client: {readinessLine(readinessByKind.client)}</>,
            <>Venue: {readinessLine(readinessByKind.venue)}</>,
          ]}
          linkHref="#playbook" linkLabel="Open Planning"
        />
        <SummaryTile
          title="Payments"
          lines={[
            `Balance due: ${formatCurrency(balanceDue)}`,
            nextDue ? `Next due ${formatDate(nextDue)}` : "No payment due date set",
          ]}
          linkHref="#invoice" linkLabel="Open Payments"
        />
        <SummaryTile
          title="Timeline"
          lines={[
            timelineCreated ? "Timeline created" : "Not created yet",
            timelineLastUpdated ? `Last updated ${formatDate(timelineLastUpdated.slice(0, 10))}` : "—",
          ]}
          linkHref="#timeline" linkLabel="Open Timeline"
        />
        <SummaryTile
          title="Vendors"
          lines={[
            `${vendorsSelected} vendor${vendorsSelected === 1 ? "" : "s"} selected`,
            `${recommendationsPending} recommendation${recommendationsPending === 1 ? "" : "s"} pending`,
          ]}
          linkHref="#vendors" linkLabel="Open Vendors"
        />
        <SummaryTile
          title="Messages"
          lines={conversationExperienceEnabled ? [
            lastConversationMessage ? `Last message: "${lastConversationMessage.body.length > 60 ? `${lastConversationMessage.body.slice(0, 60)}…` : lastConversationMessage.body}"` : "No messages yet",
            `${conversationUnread} unread`,
          ] : [
            lastThread?.lastMessagePreview ? `Last message: "${lastThread.lastMessagePreview.length > 60 ? `${lastThread.lastMessagePreview.slice(0, 60)}…` : lastThread.lastMessagePreview}"` : "No messages yet",
            "Unread not tracked for this messaging mode",
          ]}
          linkHref="#messages" linkLabel="Open Messages"
        />
        <SummaryTile
          title="Documents"
          lines={[`${documents.length} document${documents.length === 1 ? "" : "s"} uploaded`]}
          linkHref="#documents" linkLabel="Open Documents"
        />
      </div>
    </div>
  );
}
