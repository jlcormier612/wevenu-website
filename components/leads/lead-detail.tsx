"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  DollarSign,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { convertLeadToClientAction } from "@/app/(app)/clients/actions";
import { EventSpaceField } from "@/components/availability/event-space-field";
import {
  moveLeadBackToSalesPipelineAction,
  returnLeadToBookedAction,
  updateLeadStatusAction,
  wouldEnrollOnPipelineStageMoveAction,
} from "@/app/(app)/leads/[id]/actions";
import { ActivityTimelineView } from "@/components/conversations/activity-timeline";
import { LeadLifecycleConfirmDialog } from "@/components/leads/lifecycle-confirm-dialog";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { PipelineAutomationConfirmDialog } from "@/components/leads/pipeline-automation-confirm";
import { Badge } from "@/components/ui/badge";
import { NotesSection } from "@/components/leads/notes-section";
import { RelationshipCard } from "@/components/leads/relationship-card";
import { TasksSection } from "@/components/leads/tasks-section";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateHoldsSection } from "@/components/availability/date-holds-section";
import { DocumentWorkspace } from "@/components/document-workspace/document-workspace";
import type { WorkspaceDocument } from "@/lib/document-workspace/types";
import { LuvDraftPanel } from "@/components/luv/luv-draft-panel";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import { RelationshipConversationTab } from "@/components/conversations/relationship-conversation-tab";
import { TourPanel } from "@/components/leads/tour-panel";
import {
  LEAD_STATUSES,
  eventTypeLabel,
  formatCurrency,
  formatDate,
  leadDisplayName,
  sourceLabel,
} from "@/lib/leads/constants";
import { isManuallyAssignableSalesStage, type SalesStage } from "@/lib/leads/sales-stages";
import type { LeadWithDetails } from "@/lib/leads/types";
import type { DateHold, VenueSpace } from "@/lib/availability/types";
import type { Document } from "@/lib/documents/types";
import type { LuvDraft } from "@/lib/luv/drafts";

// ---- info row (overview tab) ------------------------------------------------

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ---- main component ---------------------------------------------------------

export function LeadDetail({ lead, holds = [], spaces = [], maxSimultaneousEvents = 1, documents = [], workspaceDocuments = [], pinnedDocumentKeys = [], recentDocumentEntries = [], luvDrafts = [], autoLuvDraft, tourAppointments = [], conversationId = null, now }: { lead: LeadWithDetails; holds?: DateHold[]; spaces?: VenueSpace[]; maxSimultaneousEvents?: number; documents?: Document[]; workspaceDocuments?: WorkspaceDocument[]; pinnedDocumentKeys?: string[]; recentDocumentEntries?: [string, string][]; luvDrafts?: LuvDraft[]; autoLuvDraft?: string; tourAppointments?: import("@/lib/tours/types").TourAppointment[]; conversationId?: string | null; now: string }) {
  // Controlled tabs — supports Luv→Messages bridge and ?luv= URL param routing
  const [activeTab, setActiveTab] = React.useState(autoLuvDraft ? "luv" : "overview");
  const [messagePrefill, setMessagePrefill] = React.useState<{ subject: string; body: string } | null>(null);

  function handleUseDraft(subject: string | null, body: string) {
    setMessagePrefill({ subject: subject ?? "", body });
    setActiveTab("messages");
  }
  const router = useRouter();
  const [statusPending, startStatus] = React.useTransition();
  const [convertPending, startConvert] = React.useTransition();
  const [lifecyclePending, startLifecycle] = React.useTransition();
  const [confirmStageId, setConfirmStageId] = React.useState<string | null>(null);
  const [confirmPreview, setConfirmPreview] = React.useState<import("@/lib/message-sequences/confirm-preview").AutomationMessagePreview | null>(null);
  const [bookingSpaceId, setBookingSpaceId] = React.useState("");
  const [confirmBookOpen, setConfirmBookOpen] = React.useState(false);
  const [confirmMoveBackOpen, setConfirmMoveBackOpen] = React.useState(false);
  const [confirmReturnBookedOpen, setConfirmReturnBookedOpen] = React.useState(false);
  const spacesRequired = maxSimultaneousEvents >= 2 && !!lead.eventDate && !lead.linkedClientId;
  const convertBlocked = spacesRequired && spaces.filter((s) => s.isActive).length === 0;

  function requestBookThisLead() {
    if (spacesRequired && !bookingSpaceId && spaces.filter((s) => s.isActive).length > 0) {
      toast.error("Assign an Event Space before booking.");
      return;
    }
    setConfirmBookOpen(true);
  }

  function confirmBookThisLead() {
    if (convertPending) return;
    setConfirmBookOpen(false);
    startConvert(async () => {
      const result = await convertLeadToClientAction(lead, bookingSpaceId || undefined);
      if (result.ok) {
        const params = new URLSearchParams();
        if (result.eventId) params.set("eventId", result.eventId);
        if (result.invitationSent) params.set("invited", "1");
        const qs = params.toString();
        router.push(`/clients/${result.clientId}/booked${qs ? `?${qs}` : ""}`);
      } else {
        toast.error(result.message ?? "Could not convert to client.");
      }
    });
  }

  function confirmMoveBack() {
    setConfirmMoveBackOpen(false);
    startLifecycle(async () => {
      const result = await moveLeadBackToSalesPipelineAction(lead.id);
      if (result.ok) {
        toast.success("Moved back to the Sales Pipeline.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not move this lead.");
      }
    });
  }

  function confirmReturnToBooked() {
    setConfirmReturnBookedOpen(false);
    startLifecycle(async () => {
      const result = await returnLeadToBookedAction(lead.id);
      if (result.ok) {
        toast.success("Returned to Booked.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not return to Booked.");
      }
    });
  }

  const displayName = leadDisplayName(
    lead.firstName, lead.lastName,
    lead.partnerFirstName, lead.partnerLastName,
  );

  function handleStatusChange(status: string) {
    startStatus(async () => {
      const check = await wouldEnrollOnPipelineStageMoveAction(lead.id, status);
      if (!check.ok) {
        toast.error(check.message ?? "Could not check this move.");
        return;
      }
      if (check.wouldEnroll) {
        setConfirmStageId(status);
        setConfirmPreview(check.preview);
        return;
      }
      const result = await updateLeadStatusAction(lead.id, status);
      if (result.ok) {
        toast.success("Stage updated.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update stage.");
      }
    });
  }

  function commitStageChange(stageKey: string) {
    startStatus(async () => {
      const result = await updateLeadStatusAction(lead.id, stageKey);
      if (result.ok) {
        toast.success("Stage updated.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update stage.");
      }
    });
  }

  const currentStage = (lead.salesStage ?? lead.status) as SalesStage;
  const isBooked = currentStage === "booked";
  const previouslyConverted = !!lead.linkedClientId;
  // When Booked, only Lost remains in the generic stage menu — leaving Booked
  // for an active sales stage uses Move back to Sales Pipeline.
  const assignableStages = LEAD_STATUSES.filter((s) => {
    if (!isManuallyAssignableSalesStage(s.value)) return false;
    if (isBooked) return s.value === "lost";
    return true;
  });

  const openTaskCount = lead.tasks.filter((t) => !t.completed).length;

  return (
    <div className="space-y-5">
      <PipelineAutomationConfirmDialog
        open={confirmStageId != null}
        preview={confirmPreview}
        onCancel={() => {
          setConfirmStageId(null);
          setConfirmPreview(null);
        }}
        onContinue={() => {
          if (!confirmStageId) return;
          const stageId = confirmStageId;
          setConfirmStageId(null);
          setConfirmPreview(null);
          commitStageChange(stageId);
        }}
      />
      <LeadLifecycleConfirmDialog
        open={confirmBookOpen}
        title="Book this lead?"
        description="Booked means you've won the business and are ready to start setting up the event. It doesn't necessarily mean the contract is signed or a payment has been received."
        confirmLabel="Book This Lead"
        confirming={convertPending}
        onCancel={() => setConfirmBookOpen(false)}
        onConfirm={confirmBookThisLead}
      />
      <LeadLifecycleConfirmDialog
        open={confirmMoveBackOpen}
        title="Move this lead back to the Sales Pipeline?"
        description="This changes the current sales stage only. The client, event, documents, messages, and financial information you've already created will stay in place."
        confirmLabel="Move Back to Sales Pipeline"
        confirming={lifecyclePending}
        onCancel={() => setConfirmMoveBackOpen(false)}
        onConfirm={confirmMoveBack}
      />
      <LeadLifecycleConfirmDialog
        open={confirmReturnBookedOpen}
        title="Return to Booked?"
        description="This marks the relationship as Booked again. Your existing client, event, documents, messages, and financial information stay in place — this is not a new first booking."
        confirmLabel="Return to Booked"
        confirming={lifecyclePending}
        onCancel={() => setConfirmReturnBookedOpen(false)}
        onConfirm={confirmReturnToBooked}
      />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Button
            variant="ghost" size="sm"
            className="-ml-2 text-muted-foreground"
            render={<Link href="/leads" />}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Leads
          </Button>
          <h1 className="font-heading text-2xl font-medium text-heading">
            {displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {lead.eventType && <span>{eventTypeLabel(lead.eventType)}</span>}
            {lead.eventDate && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(lead.eventDate)}
                </span>
              </>
            )}
            {lead.guestCount != null && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {lead.guestCount.toLocaleString()} guests
                </span>
              </>
            )}
            {lead.estimatedBudget != null && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {formatCurrency(lead.estimatedBudget)}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lead.otherLeadsOnRelationship > 0 && (
              <Badge variant="secondary">
                Returning relationship — {lead.otherLeadsOnRelationship} other {lead.otherLeadsOnRelationship === 1 ? "lead" : "leads"} on file
              </Badge>
            )}
            {lead.intakeConfidence != null && lead.intakeConfidence < 80 && (
              <Badge variant={lead.intakeConfidence < 50 ? "warning" : "outline"}>
                {lead.intakeConfidence < 50
                  ? "Auto-extracted — needs confirmation before automated follow-ups send"
                  : "Auto-extracted — please verify details"}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {spacesRequired && (
            <div className="w-full min-w-56">
              <EventSpaceField
                value={bookingSpaceId}
                onChange={setBookingSpaceId}
                spaces={spaces}
                spacesRequired
              />
            </div>
          )}
          <div className="flex shrink-0 items-center gap-2 flex-wrap justify-end">
          <LeadStatusBadge status={currentStage} />
          {assignableStages.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" disabled={statusPending || lifecyclePending} />}
              >
                Change stage
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {assignableStages.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    disabled={s.value === currentStage}
                    onClick={() => handleStatusChange(s.value)}
                  >
                    {s.label}
                    <span className="ml-auto pl-4 text-xs text-muted-foreground">
                      {s.description}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/leads/${lead.id}/edit`} />}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          {isBooked && (
            <Button
              variant="outline"
              size="sm"
              disabled={lifecyclePending}
              onClick={() => setConfirmMoveBackOpen(true)}
            >
              Move back to Sales Pipeline
            </Button>
          )}
          {previouslyConverted && !isBooked && currentStage !== "lost" && (
            <Button
              size="sm"
              disabled={lifecyclePending}
              onClick={() => setConfirmReturnBookedOpen(true)}
            >
              Return to Booked
            </Button>
          )}
          {previouslyConverted ? (
            <Button size="sm" variant={isBooked || currentStage === "lost" ? "default" : "outline"}
              render={<Link href={`/clients/${lead.linkedClientId}`} />}>
              View Client →
            </Button>
          ) : currentStage !== "lost" ? (
            <Button size="sm" disabled={convertPending || convertBlocked} onClick={requestBookThisLead}
              title={convertBlocked ? "Add an Event Space in Availability settings before booking." : undefined}>
              {convertPending
                ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Booking…</>
                : <><ArrowRight className="mr-1 h-3.5 w-3.5" />Book This Lead</>}
            </Button>
          ) : null}
        </div>
        </div>
      </div>

      {/* Relationship card */}
      <RelationshipCard lead={lead} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="messages">Conversation</TabsTrigger>
          <TabsTrigger value="notes">
            Notes
            {lead.notes.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {lead.notes.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks
            {openTaskCount > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {openTaskCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity
            {lead.activities.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {lead.activities.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {documents.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{documents.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="luv" className="gap-1.5">
            <LuvHeart size={12} /> Luv
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={Mail} label="Email" value={lead.email} />
                <InfoRow icon={Phone} label="Phone" value={lead.phone} />
                {(lead.partnerFirstName || lead.partnerLastName) && (
                  <>
                    <Separator />
                    <p className="text-xs font-medium text-muted-foreground">Partner</p>
                    <p className="text-sm font-medium text-foreground">
                      {[lead.partnerFirstName, lead.partnerLastName].filter(Boolean).join(" ")}
                    </p>
                    {lead.partnerEmail && (
                      <InfoRow icon={Mail} label="Partner email" value={lead.partnerEmail} />
                    )}
                  </>
                )}
                {!lead.email && !lead.phone && !lead.partnerFirstName && (
                  <p className="text-sm text-muted-foreground">No contact details recorded.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inquiry details</CardTitle>
                <CardDescription>
                  Received {formatDate(lead.inquiryDate)}
                  {lead.source && <> via {sourceLabel(lead.source)}</>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={Calendar} label="Event type" value={eventTypeLabel(lead.eventType)} />
                <InfoRow icon={Calendar} label="Preferred event date" value={formatDate(lead.eventDate)} />
                <InfoRow
                  icon={Users}
                  label="Guest count"
                  value={lead.guestCount != null ? `${lead.guestCount.toLocaleString()} guests` : undefined}
                />
                <InfoRow
                  icon={DollarSign}
                  label="Estimated budget"
                  value={formatCurrency(lead.estimatedBudget) || undefined}
                />
                {lead.inquiryMessage && (
                  <>
                    <Separator />
                    <div>
                      <Label className="mb-1 text-xs text-muted-foreground">Message</Label>
                      <p className="whitespace-pre-wrap text-sm text-foreground">
                        {lead.inquiryMessage}
                      </p>
                    </div>
                  </>
                )}
                {Array.isArray(lead.sourceData?.custom_answers) && (lead.sourceData.custom_answers as Array<{ questionText?: string; answer?: string | string[] }>).length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      {(lead.sourceData.custom_answers as Array<{ questionText?: string; answer?: string | string[] }>).map((entry, idx) => (
                        <div key={idx}>
                          <Label className="mb-1 text-xs text-muted-foreground">{entry.questionText ?? "Custom question"}</Label>
                          <p className="whitespace-pre-wrap text-sm text-foreground">
                            {Array.isArray(entry.answer) ? entry.answer.join(", ") : entry.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coordinator Tour Scheduling — always visible, not just when a
              tour already exists: this is the entry point, not a display-only
              summary. */}
          <TourPanel leadId={lead.id} tourAppointments={tourAppointments} now={now} />
        </TabsContent>

        {/* ── Conversation ─────────────────────────────────────────── */}
        <TabsContent value="messages">
          <RelationshipConversationTab
            conversationId={conversationId}
            initialBody={messagePrefill?.body}
            initialSubject={messagePrefill?.subject}
          />
        </TabsContent>

        {/* ── Notes ─────────────────────────────────────────────────── */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
              <CardDescription>
                Internal notes. Not visible to the client.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotesSection leadId={lead.id} initialNotes={lead.notes} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Date Holds ────────────────────────────────────────────── */}
        <TabsContent value="tasks">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Date Holds</CardTitle>
                <CardDescription>
                  Reserve a date for this lead without committing to a booking. Holds appear on the calendar and can be released or converted to an event.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DateHoldsSection
                  leadId={lead.id}
                  leadName={leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}
                  initialHolds={holds}
                  spaces={spaces}
                />
              </CardContent>
            </Card>
            <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks</CardTitle>
              <CardDescription>
                Action items for this lead. Click a title to edit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TasksSection leadId={lead.id} initialTasks={lead.tasks} />
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        {/* ── Activity ──────────────────────────────────────────────── */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>
                A chronological record of everything that has happened with this lead.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimelineView leadId={lead.id} clientId={null} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ────────────────────────────────────────────── */}
        <TabsContent value="documents">
          <DocumentWorkspace
            title="Documents"
            description="Contracts, inspiration photos, questionnaires, and other files for this lead."
            documents={workspaceDocuments}
            initialPinnedKeys={pinnedDocumentKeys}
            initialRecentEntries={recentDocumentEntries}
            uploadTarget={{ entityType: "lead", entityId: lead.id, venueId: lead.venueId }}
          />
        </TabsContent>

        {/* ── Luv ──────────────────────────────────────────────────── */}
        <TabsContent value="luv">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-1.5"><LuvHeart size={14} /> Luv</CardTitle>
              <CardDescription>Your venue assistant can help draft a follow-up. You review, edit, and send it yourself.</CardDescription>
            </CardHeader>
            <CardContent>
              <LuvDraftPanel lead={lead} initialDrafts={luvDrafts} onUseDraft={handleUseDraft} autoGenerateDraftType={autoLuvDraft} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
