"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileDown,
  MessageSquare,
  Pencil,
  Printer,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { updateEventStatusAction } from "@/app/(app)/events/[id]/actions";
import { sendAnniversaryMessageAction } from "@/app/(app)/events/[id]/anniversary-actions";
import { KeyDatesSection } from "@/components/clients/key-dates-section";
import { BookingOverviewSummary } from "@/components/events/booking-overview-summary";
import { EventReadinessCard } from "@/components/events/event-readiness-card";
import { QuestionnaireFamilyPanel } from "@/components/events/questionnaire-family-panel";
import type { EventReadinessSummary } from "@/lib/readiness/types";
import { BookingSetupCard } from "@/components/events/booking-setup-card";
import { TimelineSetupCard } from "@/components/events/timeline-setup-card";
import type { ClientKeyDate } from "@/lib/clients/types";
import { EventFeedbackSection } from "@/components/events/event-feedback-section";
import { EventNotesSection } from "@/components/events/event-notes-section";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { EventTeamSection } from "@/components/events/event-team-section";
import { EventVendorsSection } from "@/components/events/vendors/event-vendors-section";
import { EventVendorRecommendationsSection } from "@/components/events/vendors/event-vendor-recommendations-section";
import type { EventVendorRecommendation } from "@/lib/vendor-recommendations/types";
import { TimelineView } from "@/components/events/timeline/timeline-view";
import { FloorPlanWorkspace } from "@/components/events/floor-plan-workspace";
import type { FloorPlanTemplate } from "@/lib/floor-plan-templates/types";
import type { EventFloorPlanOfferWithTemplate } from "@/lib/floor-plan-offers/types";
import type { VenueSpace } from "@/lib/availability/types";
import { BookingDocumentsTab } from "@/components/events/booking-documents-tab";
import { RequestSummaryCard } from "@/components/events/request-summary-card";
import { EventTaskList } from "@/components/playbooks/event-task-list";
import type { LinkableConversationMessage } from "@/components/playbooks/event-task-list";
import type { TimelineEntry, TimelineEntryAttachment, TimelineEntryLink, TimelineRelatedLink, TimelineSection } from "@/lib/timeline/types";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { CreateRetainerSheet } from "@/components/payments/create-retainer-sheet";
import { EventOrderPanel } from "@/components/event-orders/event-order-panel";
import type { EventOrderWithDetails } from "@/lib/event-orders/types";
import type { InventoryItem } from "@/lib/inventory/types";
import type { Package } from "@/lib/packages/types";
import { EventInventoryPanel } from "@/components/event-inventory/event-inventory-panel";
import { RelationshipConversationTab } from "@/components/conversations/relationship-conversation-tab";
import { ActivityTimelineView } from "@/components/conversations/activity-timeline";
import type { ConversationMessage } from "@/lib/conversations/types";
import type { ClientStatus } from "@/lib/clients/types";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/invoices/constants";
import type { Invoice } from "@/lib/invoices/types";
import type { Document } from "@/lib/documents/types";
import type { WorkspaceDocument } from "@/lib/document-workspace/types";
import type { Questionnaire, QuestionnaireActivity } from "@/lib/events/questionnaire";
import type { QuestionnaireTemplate } from "@/lib/questionnaire-templates/service";
// QuestionnaireFamilyPanel replaces the single FinalDetailsForm surface.
import type { EventPlaybookApplication, EventReadiness, EventTask, EventTaskContextLink, PlaybookTemplateWithStats, TaskContact } from "@/lib/playbooks/types";
import type { TimelineTemplateWithStats } from "@/lib/timeline-templates/types";
import {
  EVENT_STATUSES,
  daysUntil,
  formatEventDateRange,
  formatTime,
} from "@/lib/events/constants";
import type { EventWithDetails } from "@/lib/events/types";

// ---- Anniversary Banner (shown on anniversary milestones) ------------------

function AnniversaryBanner({ eventId, ordinal }: { eventId: string; ordinal: string }) {
  const [message, setMessage] = React.useState("");
  const [sent, setSent]       = React.useState(false);
  const [sending, setSending] = React.useState(false);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    const result = await sendAnniversaryMessageAction(eventId, message.trim(), parseInt(ordinal) || 1);
    setSending(false);
    if (result.ok) { setSent(true); toast.success("Anniversary note sent to the client's portal."); }
    else toast.error("Could not send anniversary note.");
  }

  return (
    <div className="rounded-sm p-5 space-y-3"
      style={{ background: "linear-gradient(135deg, #FDF5F5 0%, #F9F5F0 100%)", border: "1px solid #E8C8CA" }}>
      <div className="flex items-center gap-2">
        <span className="text-xl">💗</span>
        <p className="text-sm font-semibold text-heading">{ordinal} Anniversary</p>
      </div>
      {sent ? (
        <p className="text-sm text-muted-foreground">Anniversary note sent. It will appear in the client&apos;s portal.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Send a personal anniversary note — it will appear in the client&apos;s keepsake portal.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={`Happy ${ordinal} anniversary! It was such a joy to be part of your day.`}
              className="flex-1 text-sm rounded-sm border border-border px-3 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button size="sm" disabled={!message.trim() || sending} onClick={handleSend}
              style={{ background: "#C17F84", color: "white" }}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Event Date Hero (client-side for live countdown) ----------------------

function EventHeroCard({ event }: { event: EventWithDetails }) {
  const [countdown, setCountdown] = React.useState<string>("");
  React.useEffect(() => {
    const days = daysUntil(event.eventDate);
    if (days === 0) setCountdown("Today");
    else if (days === 1) setCountdown("Tomorrow");
    else if (days > 0) setCountdown(`In ${days} days`);
    else setCountdown(`${Math.abs(days)} days ago`);
  }, [event.eventDate]);

  const dayName = new Date(event.eventDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });
  const multiDay = Boolean(event.eventEndDate && event.eventEndDate !== event.eventDate);
  const endDayName = multiDay
    ? new Date(event.eventEndDate! + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })
    : null;

  const days = daysUntil(event.eventDate);
  const urgent = days >= 0 && days <= 14;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-8 text-center space-y-3">
        <p className="font-heading text-5xl font-medium tracking-tight text-heading">
          {formatEventDateRange(event.eventDate, event.eventEndDate)}
        </p>
        <p className="text-muted-foreground">
          {multiDay ? `${dayName} – ${endDayName}` : dayName}
          {countdown ? (
            <span className={urgent ? " · font-semibold text-destructive" : " · text-muted-foreground"}>
              {" "}· {countdown}
            </span>
          ) : null}
        </p>
        {/* Day-of schedule row (multi-day: overall booking window, not daily hours) */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-sm text-muted-foreground">
          {event.startTime && (
            <span
              className="flex items-center gap-1"
              title={multiDay ? "Overall booking window — not the hour-by-hour schedule for each day" : undefined}
            >
              <Clock className="h-3.5 w-3.5" />
              {event.setupTime ? `Setup ${formatTime(event.setupTime)} · ` : ""}
              {multiDay ? "Overall " : ""}
              {formatTime(event.startTime)}
              {event.endTime ? ` → ${formatTime(event.endTime)}` : ""}
            </span>
          )}
          {event.guestCount != null && (
            <>
              {event.startTime && <span className="text-border">·</span>}
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {event.guestCount.toLocaleString()} guests
              </span>
            </>
          )}
          {event.teardownTime && (
            <>
              <span className="text-border">·</span>
              <span>Teardown {formatTime(event.teardownTime)}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Coming Soon placeholder for future modules ----------------------------

function ComingSoonTab({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="font-heading text-base font-medium text-heading">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

export function EventDetail({
  event,
  availableVendors = [],
  invoices = [],
  documents = [],
  vendorDocuments = [],
  workspaceDocuments = [],
  pinnedDocumentKeys = [],
  recentDocumentEntries = [],
  questionnaire = null,
  questionnaires = [],
  questionnaireTemplates = [],
  questionnaireActivities = [],
  questionnaireActivitiesById = {},
  coupleEmail = null,
  eventTasks = [],
  playbookTemplates = [],
  playbookApplications = [],
  timelineTemplates = [],
  timelineSections = [],
  timelineLinksByEntry = {},
  timelineAttachmentsByEntry = {},
  timelineRelatedLinksByEntry = {},
  readinessByKind = { client: null, venue: null },
  contextLinksByTask = {},
  taskContacts = {},
  linkableDocuments = [],
  linkableTimelineEntries = [],
  linkableConversationMessages = [],
  vendorRecommendations = [],
  portalToken = null,
  conversationId = null,
  conversationMessages = [],
  spaceName = null,
  venueName = "Your venue",
  clientStatus = null,
  contractTemplates = [],
  contracts = [],
  floorPlanTemplates = [],
  floorPlanOffers = [],
  spaces = [],
  inventoryUsage = [],
  floorPlanCanEdit = true,
  floorPlanCanDelete = true,
  teamMembers = [],
  eventOrderEnabled = false,
  eventOrder = null,
  packages = [],
  inventoryItems = [],
  eventInventory = null,
  inventoryTemplates = [],
  eventOrderTemplates = [],
  requestsByTaskId = {},
  requests = [],
  readinessSummary,
  originatingLeadId = null,
  keyDates = [],
  clientRehearsalDate = null,
}: {
  event: EventWithDetails;
  availableVendors?: import("@/lib/vendors/types").Vendor[];
  invoices?: Invoice[];
  documents?: Document[];
  vendorDocuments?: (Document & { vendorName: string | null })[];
  workspaceDocuments?: WorkspaceDocument[];
  pinnedDocumentKeys?: string[];
  recentDocumentEntries?: [string, string][];
  questionnaire?: Questionnaire | null;
  questionnaires?: Questionnaire[];
  questionnaireTemplates?: QuestionnaireTemplate[];
  questionnaireActivities?: QuestionnaireActivity[];
  questionnaireActivitiesById?: Record<string, QuestionnaireActivity[]>;
  coupleEmail?: string | null;
  eventTasks?: EventTask[];
  playbookTemplates?: PlaybookTemplateWithStats[];
  playbookApplications?: EventPlaybookApplication[];
  timelineTemplates?: TimelineTemplateWithStats[];
  timelineSections?: TimelineSection[];
  timelineLinksByEntry?: Record<string, TimelineEntryLink[]>;
  timelineAttachmentsByEntry?: Record<string, TimelineEntryAttachment[]>;
  timelineRelatedLinksByEntry?: Record<string, TimelineRelatedLink[]>;
  readinessByKind?: { client: EventReadiness | null; venue: EventReadiness | null };
  contextLinksByTask?: Record<string, EventTaskContextLink[]>;
  taskContacts?: Record<string, TaskContact>;
  linkableDocuments?: Document[];
  linkableTimelineEntries?: TimelineEntry[];
  linkableConversationMessages?: LinkableConversationMessage[];
  portalToken?: string | null;
  vendorRecommendations?: EventVendorRecommendation[];
  conversationId?: string | null;
  conversationMessages?: ConversationMessage[];
  spaceName?: string | null;
  venueName?: string;
  clientStatus?: ClientStatus | null;
  contractTemplates?: import("@/lib/contracts/types").ContractTemplate[];
  contracts?: import("@/lib/contracts/types").Contract[];
  floorPlanTemplates?: FloorPlanTemplate[];
  floorPlanOffers?: EventFloorPlanOfferWithTemplate[];
  spaces?: VenueSpace[];
  inventoryUsage?: import("@/lib/inventory/types").InventoryUsage[];
  /** Floor plan permissions — Staff view-only; Coordinator cannot delete plans. */
  floorPlanCanEdit?: boolean;
  floorPlanCanDelete?: boolean;
  teamMembers?: import("@/lib/team/types").StaffMember[];
  // Booking Financial Architecture Phase 2 — gated by venues.event_order_enabled.
  eventOrderEnabled?: boolean;
  eventOrder?: EventOrderWithDetails | null;
  packages?: Package[];
  inventoryItems?: InventoryItem[];
  // D5A — Event Inventory. Not feature-flagged (unlike Event Order above):
  // additive to the venue-wide catalog every venue already has.
  eventInventory?: import("@/lib/event-inventory/types").EventInventoryWithDetails | null;
  inventoryTemplates?: import("@/lib/event-inventory/types").InventoryTemplate[];
  // D7A — Event Order Templates. Same additive, non-feature-flagged shape as inventoryTemplates above.
  eventOrderTemplates?: import("@/lib/event-order-templates/types").EventOrderTemplate[];
  requestsByTaskId?: Record<string, import("@/lib/requests/types").Request>;
  requests?: import("@/lib/requests/types").Request[];
  readinessSummary: EventReadinessSummary;
  // Sales → Booking Journey walkthrough — before this, nothing on the
  // Client Workspace pointed back to the inquiry it came from, so the
  // Lead's own activity history (status changes, prior notes) had no
  // reachable path once converted, even though it was never deleted.
  originatingLeadId?: string | null;
  // Key Dates — already fetched on the Booking Workspace page via getClient();
  // mounted in Overview beside Event summary (existing KeyDatesSection).
  keyDates?: ClientKeyDate[];
  /** The client's structured Rehearsal Date (Client Info) — passed through so KeyDatesSection can synthesize a single canonical Rehearsal entry instead of allowing a second, independently-editable one. */
  clientRehearsalDate?: string | null;
}) {
  const router = useRouter();
  const [statusPending, startStatus] = React.useTransition();
  const [activeTab, setActiveTab] = React.useState("overview");
  React.useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "questionnaires") {
        setActiveTab("playbook");
        requestAnimationFrame(() => {
          document.getElementById("questionnaires")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } else if (hash) setActiveTab(hash);
      // Vendor-thread deep links: /events/{id}?conversation=… → /clients/…?conversation=…
      // Server redirects drop #vendors; open Vendors when a thread id is present.
      else if (new URLSearchParams(window.location.search).get("conversation")) {
        setActiveTab("vendors");
      }
    };
    syncFromHash();
    // An Interactive Planning Task's "Open X" button sets the hash while
    // already on this page (no remount) — listen so the tab actually switches.
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function handleStatusChange(status: string) {
    // Commitment Alignment Sprint (docs/commitment-lifecycle-architecture.md
    // §9, Booking Financial item B) — a completion-time checkpoint reusing
    // the existing finalized/finalized_at Committed markers, not a new
    // lifecycle state. UI-level only: never blocks the transition, just
    // warns, since a real event can legitimately complete without ever
    // using either feature.
    if (status === "complete") {
      const orderUnfinalized = eventOrderEnabled && eventOrder?.status !== "finalized";
      const floorPlanNotReady = event.floorPlans.length > 0 && !event.floorPlans.some((fp) => fp.finalizedAt);
      if (orderUnfinalized || floorPlanNotReady) {
        const parts = [
          orderUnfinalized && "the Event Order isn't finalized",
          floorPlanNotReady && "no Floor Plan is marked Ready",
        ].filter(Boolean).join(" and ");
        if (!confirm(`Heads up — ${parts} yet. Mark this event complete anyway?`)) return;
      }
    }
    startStatus(async () => {
      const result = await updateEventStatusAction(event.id, status);
      if (result.ok) { toast.success("Status updated."); router.refresh(); }
      else toast.error(result.message ?? "Could not update status.");
    });
  }

  const multiDay = Boolean(event.eventEndDate && event.eventEndDate !== event.eventDate);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" render={<Link href="/clients" />}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Bookings
          </Button>
          <h1 className="font-heading text-2xl font-medium text-heading">{event.name}</h1>
          {originatingLeadId && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Link href={`/leads/${originatingLeadId}`} className="hover:text-foreground hover:underline">
                View original inquiry
              </Link>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <EventStatusBadge status={event.status} />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={statusPending} />}>
              Change status
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {EVENT_STATUSES.map((s) => (
                <DropdownMenuItem key={s.value} disabled={s.value === event.status} onClick={() => handleStatusChange(s.value)}>
                  {s.label}
                  <span className="ml-auto pl-4 text-xs text-muted-foreground">{s.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" render={<Link href={`/events/${event.id}/edit`} />}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`/events/${event.id}/day-sheet`} />}>
            <Printer className="mr-1 h-3.5 w-3.5" /> Day-of Sheet
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`/calendar/booking/${event.id}`} />}>
            <Calendar className="mr-1 h-3.5 w-3.5" /> Booking Schedule
          </Button>
          {daysUntil(event.eventDate) === 0 && (
            <Button size="sm" render={<Link href={`/events/${event.id}/today`} />}
              style={{ background: "#5D6F5D", color: "white" }}>
              ✦ Today&apos;s Dashboard
            </Button>
          )}
        </div>
      </div>

      {/* ── Wedding Day banner — shows only on event date ─────────────── */}
      {daysUntil(event.eventDate) === 0 && (
        <Link href={`/events/${event.id}/today`}
          className="flex items-center justify-between rounded-sm px-5 py-4 text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #3D4F3D 0%, #5D6F5D 100%)" }}>
          <div className="flex items-center gap-3">
            <span className="text-xl">✦</span>
            <div>
              <p className="text-sm font-semibold leading-snug">Today&apos;s Wedding Day Dashboard</p>
              <p className="text-xs opacity-60 mt-0.5">Live timeline · Vendor check-in · Emergency contacts</p>
            </div>
          </div>
          <span className="text-sm font-semibold opacity-80">Open →</span>
        </Link>
      )}

      {/* ── Anniversary banner — shows on anniversary milestones ──────── */}
      {daysUntil(event.eventDate) < 0 && (() => {
        const daysSince = -daysUntil(event.eventDate);
        const yearsNum  = Math.round(daysSince / 365);
        const isAnniv   = yearsNum >= 1 && Math.abs(daysSince - yearsNum * 365) <= 3;
        const ordinal   = yearsNum === 1 ? "1st" : yearsNum === 2 ? "2nd" : yearsNum === 3 ? "3rd" : `${yearsNum}th`;
        return isAnniv ? (
          <AnniversaryBanner eventId={event.id} ordinal={ordinal} />
        ) : null;
      })()}

      {/* ── Event Date Hero ────────────────────────────────────────────── */}
      <EventHeroCard event={event} />

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      {/* URL-hash addressable so an Interactive Planning Task can navigate
          straight to the right tab (e.g. #vendors) — "tasks become
          navigation into the platform," Vendor Management Next Iteration,
          2026-07-10 — rather than just landing on the event and leaving the
          coordinator to find the right tab themselves. */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as string); window.location.hash = v as string; }}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="playbook">
            Planning
            {eventTasks.filter((t) => t.status === "overdue").length > 0 && (
              <span className="ml-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">{eventTasks.filter((t) => t.status === "overdue").length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="timeline">
            Timeline
            {event.timeline.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{event.timeline.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="floorplan">
            Floor Plans
            {event.floorPlans.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{event.floorPlans.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {documents.length > 0 && <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{documents.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="vendors">
            Vendors
            {event.vendorAssignments.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {event.vendorAssignments.length}
              </span>
            )}
          </TabsTrigger>
          {eventOrderEnabled && (
            <TabsTrigger value="event-order">
              Event Order
              {eventOrder && eventOrder.lines.length > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{eventOrder.lines.length}</span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="inventory">
            Inventory
            {eventInventory && eventInventory.items.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{eventInventory.items.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoice">
            Payments
            {invoices.length > 0 && <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{invoices.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="messages">Conversation</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="notes">
            Notes
            {event.notes.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{event.notes.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="team">
            Team
            {event.team.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{event.team.length}</span>
            )}
          </TabsTrigger>
          {daysUntil(event.eventDate) < 0 && (
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          )}
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <EventReadinessCard
            summary={readinessSummary}
            portalToken={portalToken}
            onNavigateTab={(tab) => { setActiveTab(tab); window.location.hash = tab; }}
          />
          {clientStatus && (
            <BookingOverviewSummary
              clientName={event.clientName} eventType={event.eventType} eventDate={event.eventDate}
              spaceName={spaceName} guestCount={event.guestCount} guestCountSubmission={event.guestCountSubmission} clientStatus={clientStatus}
              readinessByKind={readinessByKind}
              invoices={invoices}
              timeline={event.timeline ?? []}
              vendorAssignments={event.vendorAssignments} vendorRecommendations={vendorRecommendations}
              conversationMessages={conversationMessages}
              documents={documents}
            />
          )}
          <div id="requests-summary-card">
            <RequestSummaryCard requests={requests} />
          </div>
          <BookingSetupCard
            eventId={event.id} clientId={event.clientId} eventDate={event.eventDate} eventName={event.name}
            clientName={event.clientName} eventType={event.eventType}
            templates={playbookTemplates} applications={playbookApplications} readinessByKind={readinessByKind}
            onApplied={() => router.refresh()}
          />
          <TimelineSetupCard
            eventId={event.id} eventType={event.eventType} spaceId={event.spaceId} eventStartTime={event.startTime}
            templates={timelineTemplates} hasTimeline={(event.timeline ?? []).length > 0}
            onApplied={() => router.refresh()}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Event summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: Calendar, label: "Date", value: formatEventDateRange(event.eventDate, event.eventEndDate) },
                  { icon: Clock, label: multiDay ? "Overall start" : "Start", value: formatTime(event.startTime) },
                  { icon: Clock, label: multiDay ? "Overall end" : "End", value: formatTime(event.endTime) },
                  { icon: Wrench, label: "Setup", value: formatTime(event.setupTime) },
                  { icon: Wrench, label: "Teardown", value: formatTime(event.teardownTime) },
                  { icon: Users, label: "Guests", value: event.guestCount != null ? `${event.guestCount.toLocaleString()}` : null },
                ].filter((r) => r.value).map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium text-foreground">{value}</p>
                    </div>
                  </div>
                ))}
                {!event.startTime && !event.guestCount && (
                  <p className="text-sm text-muted-foreground">
                    No schedule details yet.{" "}
                    <Link href={`/events/${event.id}/edit`} className="font-medium text-primary hover:underline">
                      Add details →
                    </Link>
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Key Dates</CardTitle></CardHeader>
              <CardContent>
                <KeyDatesSection clientId={event.clientId!} initialKeyDates={keyDates} clientRehearsalDate={clientRehearsalDate} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Playbook ─────────────────────────────────────────────── */}
        <TabsContent value="playbook">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Planning</CardTitle>
              <CardDescription>All tasks for this event, organized by section and due date. Tasks auto-complete as work is done.</CardDescription>
            </CardHeader>
            <CardContent>
              <EventTaskList
                eventId={event.id}
                clientId={event.clientId}
                eventDate={event.eventDate}
                eventName={event.name}
                clientName={event.clientName}
                eventType={event.eventType}
                initialTasks={eventTasks}
                readinessByKind={readinessByKind}
                templates={playbookTemplates}
                applications={playbookApplications}
                contextLinksByTask={contextLinksByTask}
                taskContacts={taskContacts}
                linkableDocuments={linkableDocuments}
                linkableTimelineEntries={linkableTimelineEntries}
                linkableConversationMessages={linkableConversationMessages}
                requestsByTaskId={requestsByTaskId}
                staffOptions={teamMembers.map((m) => ({ id: m.id, name: m.name }))}
              />
            </CardContent>
          </Card>

          {/* Questionnaire Family — Client Planning, Final Details, Post-Event Feedback */}
          <Card className="mt-4" id="questionnaires">
            <CardHeader>
              <CardTitle className="text-base">Questionnaires</CardTitle>
              <CardDescription>
                Client Planning Questionnaire, Final Details, and Post-Event Feedback — create a draft from the Library, review as the client, then send when ready.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuestionnaireFamilyPanel
                eventId={event.id}
                questionnaires={questionnaires.length > 0 ? questionnaires : (questionnaire ? [questionnaire] : [])}
                templates={questionnaireTemplates}
                activitiesById={
                  Object.keys(questionnaireActivitiesById).length > 0
                    ? questionnaireActivitiesById
                    : (questionnaire ? { [questionnaire.id]: questionnaireActivities } : {})
                }
                coupleEmail={coupleEmail}
                coupleName={event.clientName}
                eventName={event.name}
                venueName={venueName}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Timeline ──────────────────────────────────────────────── */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Timeline</CardTitle>
                  <CardDescription>
                    The moment-by-moment schedule your team needs to run the day.
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline" size="sm"
                    render={<Link href={`/events/${event.id}/timeline-print`} target="_blank" rel="noopener noreferrer" />}
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5" />Print Timeline
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    render={<Link href={`/events/${event.id}/timeline-print`} target="_blank" rel="noopener noreferrer" />}
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5" />Export Timeline (PDF)
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TimelineView
                eventId={event.id}
                venueId={event.venueId}
                eventStartTime={event.startTime}
                eventDate={event.eventDate}
                eventEndDate={event.eventEndDate}
                initialEntries={event.timeline ?? []}
                initialSections={timelineSections}
                initialLinksByEntry={timelineLinksByEntry}
                initialAttachmentsByEntry={timelineAttachmentsByEntry}
                availableDocuments={documents}
                initialRelatedLinksByEntry={timelineRelatedLinksByEntry}
                eventTasks={eventTasks}
                vendorAssignments={event.vendorAssignments}
                floorPlans={event.floorPlans}
                conversationId={conversationId}
                invoices={invoices}
                teamMembers={teamMembers}
                timelineTemplates={timelineTemplates}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Floor Plans ───────────────────────────────────────────── */}
        <TabsContent value="floorplan">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Floor Plans</CardTitle>
              <CardDescription>
                These floor plans belong to this booking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FloorPlanWorkspace
                eventId={event.id}
                floorPlans={event.floorPlans}
                templates={floorPlanTemplates}
                offers={floorPlanOffers}
                spaces={spaces}
                eventSpaceId={event.spaceId}
                operationalFloorPlanId={event.operationalFloorPlanId}
                coupleSelectedFloorPlanId={event.coupleSelectedFloorPlanId}
                inventoryUsage={inventoryUsage}
                canEdit={floorPlanCanEdit}
                canDelete={floorPlanCanDelete}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ────────────────────────────────────────────── */}
        <TabsContent value="documents">
          <BookingDocumentsTab
            entityType="event" entityId={event.id} venueId={event.venueId} documents={documents}
            vendorDocuments={vendorDocuments}
            workspaceDocuments={workspaceDocuments}
            pinnedDocumentKeys={pinnedDocumentKeys}
            recentDocumentEntries={recentDocumentEntries}
            contractTemplates={contractTemplates} contracts={contracts} questionnaire={questionnaire}
            eventId={event.id} eventName={event.name} coupleEmail={coupleEmail} coupleName={event.clientName}
          />
        </TabsContent>

        {/* ── Vendors ────────────────────────────────────────────────── */}
        <TabsContent value="vendors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended to {event.clientName || "the Client"}</CardTitle>
              <CardDescription>
                Vendors from your Library, suggested for this client to consider. They&apos;ll see these in their portal and can choose one — you&apos;ll see their pick here immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventVendorRecommendationsSection
                eventId={event.id}
                clientName={event.clientName}
                initialRecommendations={vendorRecommendations}
                vendorLibrary={availableVendors}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assigned to This Event</CardTitle>
              <CardDescription>
                Who is operationally confirmed and working this event, and when they arrive — separate from what&apos;s recommended to the client above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventVendorsSection
                eventId={event.id}
                initialAssignments={event.vendorAssignments}
                availableVendors={availableVendors}
                vendorDocuments={vendorDocuments}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Event Order ──────────────────────────────────────────── */}
        {eventOrderEnabled && (
          <TabsContent value="event-order">
            <EventOrderPanel eventId={event.id} clientId={event.clientId} clientName={event.clientName} clientEmail={coupleEmail} venueName={venueName} eventOrder={eventOrder} packages={packages} inventoryItems={inventoryItems} invoices={invoices} floorPlans={event.floorPlans} templates={eventOrderTemplates}
              overview={{
                eventName: event.name,
                eventDate: event.eventDate,
                eventType: event.eventType,
                guestCount: event.guestCount,
                spaceName,
                ceremonyStartTime: questionnaire?.ceremonyStartTime ?? null,
                receptionStartTime: questionnaire?.receptionStartTime ?? null,
              }} />
          </TabsContent>
        )}

        {/* ── Event Inventory (D5A) ──────────────────────────────────── */}
        <TabsContent value="inventory">
          <EventInventoryPanel eventId={event.id} eventInventory={eventInventory} templates={inventoryTemplates} catalogItems={inventoryItems} />
        </TabsContent>

        {/* ── Invoice / Payments ────────────────────────────────────── */}
        <TabsContent value="invoice">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Payments</CardTitle>
                  <CardDescription>Financial summary for this event.</CardDescription>
                </div>
                <Button type="button" size="sm"
                  render={<Link href={`/invoices/new?eventId=${event.id}${event.clientId ? `&clientId=${event.clientId}` : ""}`} />}>
                  + New Invoice
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">No invoice yet.</p>
                  <div className="flex items-center gap-2">
                    {event.clientId && <CreateRetainerSheet eventId={event.id} clientId={event.clientId} />}
                    <Button type="button" variant="outline" size="sm"
                      render={<Link href={`/invoices/new?eventId=${event.id}${event.clientId ? `&clientId=${event.clientId}` : ""}`} />}>
                      Create Full Invoice
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <Link key={inv.id} href={`/invoices/${inv.id}`}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-heading">{inv.invoiceNumber}</p>
                          <InvoiceStatusBadge status={inv.status} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-heading">{formatCurrency(inv.total)}</p>
                        {inv.balanceDue > 0 && inv.status !== "paid" && (
                          <p className="text-xs text-destructive">{formatCurrency(inv.balanceDue)} due</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Messages ─────────────────────────────────────────────── */}
        <TabsContent value="messages">
          <RelationshipConversationTab conversationId={conversationId} />
        </TabsContent>

        {/* ── Activity — RC2, Milestone 4: the relationship's audit trail ── */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>What happened, in order — the Conversation tab has what was said.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimelineView leadId={originatingLeadId} clientId={event.clientId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notes ──────────────────────────────────────────────────── */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
              <CardDescription>Operational notes for this event. Not visible to clients.</CardDescription>
            </CardHeader>
            <CardContent>
              <EventNotesSection eventId={event.id} initialNotes={event.notes} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Team ───────────────────────────────────────────────────── */}
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Team</CardTitle>
              <CardDescription>Internal staff assigned to work this event.</CardDescription>
            </CardHeader>
            <CardContent>
              <EventTeamSection eventId={event.id} initialTeam={event.team} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Feedback — post-wedding only ──────────────────────────── */}
        {daysUntil(event.eventDate) < 0 && (
          <TabsContent value="feedback">
            <div className="space-y-1 mb-4">
              <p className="text-sm font-semibold text-heading">Feedback & Memories</p>
              <p className="text-xs text-muted-foreground">
                Private feedback from the client, referrals they&apos;ve sent, and photos shared from their day.
                Nothing is public until you explicitly approve it.
              </p>
            </div>
            <EventFeedbackSection eventId={event.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
