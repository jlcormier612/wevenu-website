"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MessageSquare,
  Pencil,
  Printer,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { updateEventStatusAction } from "@/app/(app)/events/[id]/actions";
import { EventNotesSection } from "@/components/events/event-notes-section";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { EventTeamSection } from "@/components/events/event-team-section";
import { EventVendorsSection } from "@/components/events/vendors/event-vendors-section";
import { TimelineView } from "@/components/events/timeline/timeline-view";
import { DocumentsSection } from "@/components/documents/documents-section";
import { FinalDetailsForm } from "@/components/events/final-details-form";
import { EventTaskList } from "@/components/playbooks/event-task-list";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FloorPlanEditor } from "@/components/floor-plan/floor-plan-editor";
import { formatCurrency } from "@/lib/invoices/constants";
import type { Invoice } from "@/lib/invoices/types";
import type { Document } from "@/lib/documents/types";
import type { Questionnaire } from "@/lib/events/questionnaire";
import type { EventTask, PlaybookTemplate } from "@/lib/playbooks/types";
import {
  EVENT_STATUSES,
  daysUntil,
  formatDate,
  formatTime,
} from "@/lib/events/constants";
import type { EventWithDetails } from "@/lib/events/types";
import { eventTypeLabel } from "@/lib/leads/constants";

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

  const days = daysUntil(event.eventDate);
  const urgent = days >= 0 && days <= 14;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-8 text-center space-y-3">
        <p className="font-heading text-5xl font-medium tracking-tight text-heading">
          {formatDate(event.eventDate)}
        </p>
        <p className="text-muted-foreground">
          {dayName}
          {countdown ? (
            <span className={urgent ? " · font-semibold text-destructive" : " · text-muted-foreground"}>
              {" "}· {countdown}
            </span>
          ) : null}
        </p>
        {/* Day-of schedule row */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-sm text-muted-foreground">
          {event.startTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {event.setupTime ? `Setup ${formatTime(event.setupTime)} · ` : ""}
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
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
  questionnaire = null,
  coupleEmail = null,
  eventTasks = [],
  playbookTemplates = [],
}: {
  event: EventWithDetails;
  availableVendors?: import("@/lib/vendors/types").Vendor[];
  invoices?: Invoice[];
  documents?: Document[];
  questionnaire?: Questionnaire | null;
  coupleEmail?: string | null;
  eventTasks?: EventTask[];
  playbookTemplates?: PlaybookTemplate[];
}) {
  const router = useRouter();
  const [statusPending, startStatus] = React.useTransition();

  function handleStatusChange(status: string) {
    startStatus(async () => {
      const result = await updateEventStatusAction(event.id, status);
      if (result.ok) { toast.success("Status updated."); router.refresh(); }
      else toast.error(result.message ?? "Could not update status.");
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" render={<Link href="/events" />}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Events
          </Button>
          <h1 className="font-heading text-2xl font-medium text-heading">{event.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {event.eventType && <span>{eventTypeLabel(event.eventType)}</span>}
            {event.clientName && (
              <>
                <span className="text-border">·</span>
                <span>
                  {event.clientId ? (
                    <Link href={`/clients/${event.clientId}`} className="font-medium text-primary hover:underline">
                      {event.clientName} →
                    </Link>
                  ) : event.clientName}
                </span>
              </>
            )}
          </div>
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
        </div>
      </div>

      {/* ── Event Date Hero ────────────────────────────────────────────── */}
      <EventHeroCard event={event} />

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
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
          <TabsTrigger value="playbook">
            Playbook
            {eventTasks.filter((t) => t.status === "overdue").length > 0 && (
              <span className="ml-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">{eventTasks.filter((t) => t.status === "overdue").length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="vendors">
            Vendors
            {event.vendorAssignments.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {event.vendorAssignments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="floor-plan">Floor Plan</TabsTrigger>
          <TabsTrigger value="invoice">
            Invoice
            {invoices.length > 0 && <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{invoices.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="final-details">
            Final Details
            {questionnaire?.status === "submitted" && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-success inline-block" />}
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {documents.length > 0 && <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{documents.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Event summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: Calendar, label: "Date", value: formatDate(event.eventDate) },
                  { icon: Clock, label: "Start", value: formatTime(event.startTime) },
                  { icon: Clock, label: "End", value: formatTime(event.endTime) },
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

            {event.clientName && event.clientId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Booked couple</CardTitle>
                  <CardDescription>Client linked to this event.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-foreground">{event.clientName}</p>
                  <Link href={`/clients/${event.clientId}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                    View client record →
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
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

        {/* ── Timeline ──────────────────────────────────────────────── */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Day-of Timeline</CardTitle>
              <CardDescription>
                The moment-by-moment schedule your team needs to run the day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimelineView
                eventId={event.id}
                eventStartTime={event.startTime}
                initialEntries={event.timeline ?? []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Vendors ────────────────────────────────────────────────── */}
        <TabsContent value="vendors">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendors</CardTitle>
              <CardDescription>
                Who is involved in this event and when they arrive.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventVendorsSection
                eventId={event.id}
                initialAssignments={event.vendorAssignments}
                availableVendors={availableVendors}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Floor Plan ────────────────────────────────────────────── */}
        <TabsContent value="floor-plan">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Floor Plan</CardTitle>
              <CardDescription>
                Visualize and communicate the event layout. Click a toolbar item then click
                the canvas to place objects. Drag to reposition.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FloorPlanEditor
                initialPlan={event.floorPlan}
                eventId={event.id}
                eventName={event.name}
                venueId={event.venueId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Activity ───────────────────────────────────────────────── */}
        {/* ── Invoice ─────────────────────────────────────────────────── */}
        <TabsContent value="invoice">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Invoice</CardTitle>
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
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No invoice yet.{" "}
                  <Link href={`/invoices/new?eventId=${event.id}${event.clientId ? `&clientId=${event.clientId}` : ""}`}
                    className="text-primary hover:underline">
                    Create one →
                  </Link>
                </p>
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

        {/* ── Playbook ─────────────────────────────────────────────── */}
        <TabsContent value="playbook">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Playbook</CardTitle>
              <CardDescription>All tasks for this event, organized by status and due date. Tasks auto-complete as milestones are hit.</CardDescription>
            </CardHeader>
            <CardContent>
              <EventTaskList
                eventId={event.id}
                eventDate={event.eventDate}
                initialTasks={eventTasks}
                readiness={null}
                templates={playbookTemplates}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Final Details ────────────────────────────────────────── */}
        <TabsContent value="final-details">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Final Details</CardTitle>
              <CardDescription>
                Ceremony timing, guest counts, music selections, vendor notes, and special requests.
                Submitting this marks Planning Progress as complete.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FinalDetailsForm
                eventId={event.id}
                initial={questionnaire}
                coupleEmail={coupleEmail}
                coupleName={event.clientName}
                eventName={event.name}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ────────────────────────────────────────────── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
              <CardDescription>COIs, permits, vendor agreements, floor plans, and other event files.</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentsSection
                entityType="event"
                entityId={event.id}
                venueId={event.venueId}
                initialDocuments={documents}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>A record of everything that has happened with this event.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={event.activities} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
