"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Mail, Pencil, Phone, Users } from "lucide-react";
import { toast } from "sonner";

import { updateClientStatusAction } from "@/app/(app)/clients/[id]/actions";
import { ClientNotesSection } from "@/components/clients/client-notes-section";
import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { KeyDatesSection } from "@/components/clients/key-dates-section";
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
import {
  CLIENT_STATUSES,
  clientDisplayName,
  daysUntil,
  eventTypeLabel,
  formatDate,
  formatTime,
} from "@/lib/clients/constants";
import type { ClientWithDetails } from "@/lib/clients/types";

// ---- Event Date Hero (client-side for real-time countdown) ------------------

function EventDateHero({ iso }: { iso: string }) {
  const [label, setLabel] = React.useState("");
  React.useEffect(() => {
    const days = daysUntil(iso);
    if (days === 0) setLabel("Today");
    else if (days > 0) setLabel(`In ${days} day${days === 1 ? "" : "s"}`);
    else setLabel(`${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`);
  }, [iso]);
  const dayName = new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
  return (
    <div className="text-right">
      <p className="font-heading text-xl font-medium text-heading">{formatDate(iso)}</p>
      <p className="text-xs text-muted-foreground">{dayName}{label ? ` · ${label}` : ""}</p>
    </div>
  );
}

// ---- Contact info row -------------------------------------------------------

function ContactCard({ name, email, phone, role }: { name: string; email?: string | null; phone?: string | null; role: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{role}</p>
      <p className="font-heading text-base font-medium text-heading">{name}</p>
      {email && <div className="flex items-center gap-2 text-sm text-foreground"><Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{email}</div>}
      {phone && <div className="flex items-center gap-2 text-sm text-foreground"><Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{phone}</div>}
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

export function ClientDetail({ client }: { client: ClientWithDetails }) {
  const router = useRouter();
  const [statusPending, startStatus] = React.useTransition();

  const displayName = clientDisplayName(
    client.firstName, client.lastName,
    client.partnerFirstName, client.partnerLastName,
  );

  function handleStatusChange(status: string) {
    startStatus(async () => {
      const result = await updateClientStatusAction(client.id, status);
      if (result.ok) { toast.success("Status updated."); router.refresh(); }
      else toast.error(result.message ?? "Could not update status.");
    });
  }

  const partner = client.partnerFirstName || client.partnerLastName;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" render={<Link href="/clients" />}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Clients
          </Button>
          <h1 className="font-heading text-2xl font-medium text-heading">{displayName}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {client.eventType && <span>{eventTypeLabel(client.eventType)}</span>}
            {client.guestCount != null && (
              <><span className="text-border">·</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{client.guestCount.toLocaleString()} guests</span></>
            )}
            {client.ceremonyTime && (
              <><span className="text-border">·</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Ceremony {formatTime(client.ceremonyTime)}</span></>
            )}
            {client.receptionTime && (
              <><span className="text-border">·</span>
              <span>Reception {formatTime(client.receptionTime)}</span></>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3">
          {/* Event date hero */}
          {client.eventDate && <EventDateHero iso={client.eventDate} />}
          <div className="flex items-center gap-2">
            <ClientStatusBadge status={client.status} />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={statusPending} />}>
                Change status
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {CLIENT_STATUSES.map((s) => (
                  <DropdownMenuItem key={s.value} disabled={s.value === client.status} onClick={() => handleStatusChange(s.value)}>
                    {s.label}
                    <span className="ml-auto pl-4 text-xs text-muted-foreground">{s.description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" render={<Link href={`/clients/${client.id}/edit`} />}>
              <Pencil className="mr-1 h-3.5 w-3.5" />Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Couple</TabsTrigger>
          <TabsTrigger value="key-dates">
            Key Dates
            {client.keyDates.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{client.keyDates.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notes">
            Notes
            {client.notes.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{client.notes.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* ── Couple ────────────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className={`grid gap-4 ${partner ? "lg:grid-cols-2" : ""}`}>
            <Card>
              <CardHeader><CardTitle className="text-base">Contact — {client.firstName} {client.lastName}</CardTitle></CardHeader>
              <CardContent>
                <ContactCard
                  name={`${client.firstName} ${client.lastName}`}
                  email={client.email}
                  phone={client.phone}
                  role="Primary contact"
                />
              </CardContent>
            </Card>
            {partner && (
              <Card>
                <CardHeader><CardTitle className="text-base">Contact — {client.partnerFirstName} {client.partnerLastName}</CardTitle></CardHeader>
                <CardContent>
                  <ContactCard
                    name={[client.partnerFirstName, client.partnerLastName].filter(Boolean).join(" ")}
                    email={client.partnerEmail}
                    role="Partner"
                  />
                </CardContent>
              </Card>
            )}
          </div>
          {/* Rehearsal info */}
          {(client.rehearsalDate || client.internalNotes) && (
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-base">Event notes</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {client.rehearsalDate && (
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Calendar className="h-3.5 w-3.5" /></span>
                    <div><p className="text-xs text-muted-foreground">Rehearsal</p><p className="text-sm font-medium text-foreground">{formatDate(client.rehearsalDate)}</p></div>
                  </div>
                )}
                {client.rehearsalDate && client.internalNotes && <Separator />}
                {client.internalNotes && (
                  <div><p className="text-xs text-muted-foreground mb-1">Internal notes</p><p className="whitespace-pre-wrap text-sm text-foreground">{client.internalNotes}</p></div>
                )}
              </CardContent>
            </Card>
          )}
          {client.leadId && (
            <div className="mt-3 text-xs text-muted-foreground">
              Converted from lead inquiry.{" "}
              <Link href={`/leads/${client.leadId}`} className="font-medium text-primary hover:underline">View original inquiry →</Link>
            </div>
          )}
          {/* Event link — shows once an event exists, or offers to create one */}
          <div className="mt-4 flex items-center gap-2">
            {client.linkedEventId ? (
              <Button size="sm" render={<Link href={`/events/${client.linkedEventId}`} />}>
                View Event →
              </Button>
            ) : (
              <Button size="sm" variant="outline" render={<Link href={`/events/new?clientId=${client.id}`} />}>
                + Create Event
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ── Key Dates ──────────────────────────────────────────────────── */}
        <TabsContent value="key-dates">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Key Dates</CardTitle>
              <CardDescription>Milestone dates for this event: rehearsal, deadlines, and more.</CardDescription>
            </CardHeader>
            <CardContent>
              <KeyDatesSection clientId={client.id} initialKeyDates={client.keyDates} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notes ──────────────────────────────────────────────────────── */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
              <CardDescription>Internal notes about this booking. Not visible to the couple.</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientNotesSection clientId={client.id} initialNotes={client.notes} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Timeline ───────────────────────────────────────────────────── */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
              <CardDescription>A record of everything that has happened with this booking.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={client.activities} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
