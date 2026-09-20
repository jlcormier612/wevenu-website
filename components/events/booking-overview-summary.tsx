import type { ReactNode } from "react";

import Link from "next/link";

import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/events/constants";
import { eventTypeLabel } from "@/lib/leads/constants";
import type { ClientStatus } from "@/lib/clients/types";
import type { EventReadiness } from "@/lib/playbooks/types";
import type { Invoice } from "@/lib/invoices/types";
import { formatCurrency } from "@/lib/invoices/constants";
import { pickNextOpenPaymentLine } from "@/lib/invoices/amount-due-now";
import type { TimelineEntry } from "@/lib/timeline/types";
import type { EventVendorAssignment } from "@/lib/vendors/types";
import type { EventVendorRecommendation } from "@/lib/vendor-recommendations/types";
import type { ConversationMessage } from "@/lib/conversations/types";
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
  clientName, eventType, eventDate, spaceName, guestCount, guestCountSubmission, clientStatus,
  readinessByKind,
  invoices,
  paymentScheduleLines = null,
  timeline,
  vendorAssignments, vendorRecommendations,
  conversationMessages,
  documents,
  contact = null,
}: {
  clientName: string | null;
  eventType: string | null;
  eventDate: string;
  spaceName: string | null;
  guestCount: number | null;
  guestCountSubmission?: { count: number; submittedAt: string } | null;
  clientStatus: ClientStatus;
  readinessByKind: { client: EventReadiness | null; venue: EventReadiness | null };
  invoices: Invoice[];
  paymentScheduleLines?: { status: string; dueDate?: string | null; amount?: number }[] | null;
  timeline: TimelineEntry[];
  vendorAssignments: EventVendorAssignment[];
  vendorRecommendations: EventVendorRecommendation[];
  conversationMessages: ConversationMessage[];
  documents: Document[];
  /** Current contact on the client, plus historical source and inquiry from the lead. */
  contact?: {
    clientId: string;
    firstName: string | null;
    lastName: string | null;
    partnerFirstName: string | null;
    partnerLastName: string | null;
    phone: string | null;
    email: string | null;
    partnerEmail: string | null;
    source: string | null;
    inquiryMessage: string | null;
  } | null;
}) {
  // ---- Payments: simple sums/finds over already-fetched invoices, nothing new invented ----
  const balanceDue = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
  const nextFromSchedule = paymentScheduleLines
    ? pickNextOpenPaymentLine(
        paymentScheduleLines.map((l) => ({
          status: l.status,
          dueDate: l.dueDate ?? null,
          amount: l.amount ?? 0,
        })),
      )?.dueDate ?? null
    : null;
  const nextDue = nextFromSchedule ?? invoices
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

  // ---- Messages: real per-message unread count (venueReadAt). ----
  const lastConversationMessage = [...conversationMessages].sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))[0];
  const conversationUnread = conversationMessages.filter((m) => m.senderType === "lead_or_client" && !m.venueReadAt).length;

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
            {guestCountSubmission && (
              <span className="ml-1.5 text-xs" style={{ color: "#5D6F5D" }}>
                (submitted by couple {formatDate(guestCountSubmission.submittedAt)})
              </span>
            )}
          </span>
          <ClientStatusBadge status={clientStatus} />
        </CardContent>
      </Card>
      {(contact) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contact Information</CardTitle>
            <CardAction>
              <Link
                href={`/clients/${contact.clientId}/edit`}
                className="text-xs font-medium text-primary hover:underline"
                aria-label="Edit contact information"
              >
                Edit
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p>
              <span className="text-muted-foreground">Name · </span>
              {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"}
            </p>
            <p><span className="text-muted-foreground">Phone · </span>{contact.phone || "—"}</p>
            <p><span className="text-muted-foreground">Email · </span>{contact.email || "—"}</p>
            <p>
              <span className="text-muted-foreground">Partner · </span>
              {[contact.partnerFirstName, contact.partnerLastName].filter(Boolean).join(" ") || "—"}
            </p>
            <p><span className="text-muted-foreground">Partner email · </span>{contact.partnerEmail || "—"}</p>
            {contact.source && <p><span className="text-muted-foreground">Source · </span>{contact.source}</p>}
            {contact.inquiryMessage && (
              <p className="whitespace-pre-wrap pt-1 text-foreground">
                <span className="text-muted-foreground">Original inquiry · </span>
                {contact.inquiryMessage}
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
          title="Conversation"
          lines={[
            lastConversationMessage ? `Last message: "${lastConversationMessage.body.length > 60 ? `${lastConversationMessage.body.slice(0, 60)}…` : lastConversationMessage.body}"` : "No messages yet",
            `${conversationUnread} unread`,
          ]}
          linkHref="#messages" linkLabel="Open Conversation"
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
