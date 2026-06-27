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
import { updateLeadStatusAction } from "@/app/(app)/leads/[id]/actions";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
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
import { DocumentsSection } from "@/components/documents/documents-section";
import { LuvDraftPanel } from "@/components/luv/luv-draft-panel";
import {
  LEAD_STATUSES,
  eventTypeLabel,
  formatCurrency,
  formatDate,
  leadDisplayName,
  sourceLabel,
} from "@/lib/leads/constants";
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

export function LeadDetail({ lead, holds = [], spaces = [], documents = [], luvDrafts = [] }: { lead: LeadWithDetails; holds?: DateHold[]; spaces?: VenueSpace[]; documents?: Document[]; luvDrafts?: LuvDraft[] }) {
  const router = useRouter();
  const [statusPending, startStatus] = React.useTransition();
  const [convertPending, startConvert] = React.useTransition();

  function handleConvert() {
    startConvert(async () => {
      const result = await convertLeadToClientAction(lead);
      if (result.ok) {
        // Route to the celebration page — the client detail is one step away from there.
        router.push(`/clients/${result.clientId}/booked`);
      } else {
        toast.error(result.message ?? "Could not convert to client.");
      }
    });
  }

  const displayName = leadDisplayName(
    lead.firstName, lead.lastName,
    lead.partnerFirstName, lead.partnerLastName,
  );

  function handleStatusChange(status: string) {
    startStatus(async () => {
      const result = await updateLeadStatusAction(lead.id, status);
      if (result.ok) {
        toast.success("Status updated.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update status.");
      }
    });
  }

  const openTaskCount = lead.tasks.filter((t) => !t.completed).length;

  return (
    <div className="space-y-5">
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
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LeadStatusBadge status={lead.status} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" disabled={statusPending} />}
            >
              Change status
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LEAD_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  disabled={s.value === lead.status}
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
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/leads/${lead.id}/edit`} />}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          {/* Convert / View Client — only on won leads */}
          {lead.status === "won" && (
            lead.linkedClientId ? (
              <Button size="sm" render={<Link href={`/clients/${lead.linkedClientId}`} />}>
                View Client →
              </Button>
            ) : (
              <Button size="sm" disabled={convertPending} onClick={handleConvert}>
                {convertPending
                  ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Converting…</>
                  : <><ArrowRight className="mr-1 h-3.5 w-3.5" />Convert to Client</>}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Relationship card */}
      <RelationshipCard lead={lead} />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
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
          <TabsTrigger value="luv" className="gap-1">
            <span style={{ color: "#D8A7AA" }}>♥</span> Luv
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
                <InfoRow icon={Calendar} label="Event date" value={formatDate(lead.eventDate)} />
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
              </CardContent>
            </Card>
          </div>
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
                Action items for this lead. Click a title to edit. Press Enter or ⌘↵ to save.
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
              <ActivityTimeline activities={lead.activities} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ────────────────────────────────────────────── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
              <CardDescription>Contracts, inspiration photos, questionnaires, and other files for this lead.</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentsSection
                entityType="lead"
                entityId={lead.id}
                venueId={lead.venueId}
                initialDocuments={documents}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Luv ──────────────────────────────────────────────────── */}
        <TabsContent value="luv">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">♥ Luv</CardTitle>
              <CardDescription>Your venue assistant can help draft a follow-up. You review, edit, and send it yourself.</CardDescription>
            </CardHeader>
            <CardContent>
              <LuvDraftPanel lead={lead} initialDrafts={luvDrafts} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
