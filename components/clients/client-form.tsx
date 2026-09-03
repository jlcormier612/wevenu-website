"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClientAction } from "@/app/(app)/clients/actions";
import { ConflictWarning } from "@/components/availability/conflict-warning";
import { EventSpaceField } from "@/components/availability/event-space-field";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  EVENT_TYPES,
  createInitialClientInput,
  eventTypeLabel,
  formatDate,
} from "@/lib/clients/constants";
import type { ClientErrors, ClientInput } from "@/lib/clients/types";
import type { VenueSpace } from "@/lib/availability/types";

/**
 * Commitment Alignment Sprint (docs/commitment-lifecycle-architecture.md
 * §9, Booking Financial item C) — once an Event exists, it's the sole
 * canonical writer for guest_count/event_type/event_date. Client keeps
 * showing the value for continuity, but read-only with a link to where
 * it's actually managed now, rather than a silently-disabled input.
 */
function ManagedOnEventField({ label, value, eventId }: { label: string; value: string; eventId: string }) {
  return (
    <Field label={label} hint="Managed on the Event now.">
      <div className="flex h-9 items-center justify-between rounded-md border border-border bg-muted/40 px-3 text-sm">
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || "—"}</span>
        <Link href={`/events/${eventId}/edit`} className="text-xs font-medium text-primary hover:underline shrink-0 ml-2">
          Edit on Event →
        </Link>
      </div>
    </Field>
  );
}

export function ClientForm({
  spaces = [],
  maxSimultaneousEvents = 1,
}: {
  spaces?: VenueSpace[];
  maxSimultaneousEvents?: number;
}) {
  const router = useRouter();
  const [input, setInput] = React.useState<ClientInput>(() => createInitialClientInput());
  const [errors, setErrors] = React.useState<ClientErrors>({});
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => {
    setInput((p) => ({ ...p, [key]: value }));
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = await createClientAction(input);
      if (result.ok) {
        const params = new URLSearchParams();
        if (result.eventId) params.set("eventId", result.eventId);
        if (result.invitationSent) params.set("invited", "1");
        const qs = params.toString();
        router.push(`/clients/${result.clientId}/booked${qs ? `?${qs}` : ""}`);
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return <ClientFormFields input={input} errors={errors} set={set} onSubmit={handleSubmit} pending={pending} spaces={spaces} maxSimultaneousEvents={maxSimultaneousEvents} />;
}

export function ClientFormFields({
  input, errors, set, onSubmit, pending, submitLabel = "Save client", linkedEventId = null,
  spaces = [], maxSimultaneousEvents = 1,
}: {
  input: ClientInput;
  errors: ClientErrors;
  set: <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => void;
  onSubmit: () => void;
  pending: boolean;
  submitLabel?: string;
  linkedEventId?: string | null;
  spaces?: VenueSpace[];
  maxSimultaneousEvents?: number;
}) {
  const router = useRouter();
  const [dateBlocked, setDateBlocked] = React.useState(false);
  const spacesRequired = maxSimultaneousEvents >= 2 && !linkedEventId;

  return (
    <div className="space-y-6">
      {/* Couple */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-heading">Person 1</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="fn" required error={errors.firstName}>
            <Input id="fn" value={input.firstName} onChange={(e) => set("firstName", e.target.value)} aria-invalid={errors.firstName ? true : undefined} />
          </Field>
          <Field label="Last name" htmlFor="ln" required error={errors.lastName}>
            <Input id="ln" value={input.lastName} onChange={(e) => set("lastName", e.target.value)} aria-invalid={errors.lastName ? true : undefined} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="em" error={errors.email}>
            <Input id="em" type="email" value={input.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="ph">
            <Input id="ph" type="tel" value={input.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </div>
      </div>
      <Separator />
      <div className="space-y-4">
        <p className="text-sm font-medium text-heading">Person 2 <span className="font-normal text-muted-foreground">(optional)</span></p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="pfn">
            <Input id="pfn" value={input.partnerFirstName} onChange={(e) => set("partnerFirstName", e.target.value)} />
          </Field>
          <Field label="Last name" htmlFor="pln">
            <Input id="pln" value={input.partnerLastName} onChange={(e) => set("partnerLastName", e.target.value)} />
          </Field>
        </div>
        <Field label="Email" htmlFor="pem" error={errors.partnerEmail}>
          <Input id="pem" type="email" value={input.partnerEmail} onChange={(e) => set("partnerEmail", e.target.value)} />
        </Field>
      </div>
      <Separator />
      {/* Event */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-heading">Event details</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {linkedEventId ? (
            <ManagedOnEventField label="Event type" value={eventTypeLabel(input.eventType)} eventId={linkedEventId} />
          ) : (
            <Field label="Event type" htmlFor="et">
              <Select value={input.eventType} onValueChange={(v) => set("eventType", v)} items={EVENT_TYPES}>
                <SelectTrigger id="et"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          {linkedEventId ? (
            <ManagedOnEventField label="Event date" value={formatDate(input.eventDate)} eventId={linkedEventId} />
          ) : (
            <Field label="Event date" htmlFor="ed">
              <Input id="ed" type="date" value={input.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
            </Field>
          )}
        </div>
        {!linkedEventId && (
          <>
            <EventSpaceField
              value={input.spaceId}
              onChange={(v) => set("spaceId", v)}
              spaces={spaces}
              spacesRequired={spacesRequired}
              error={errors.spaceId}
            />
            {input.eventDate && (
              <ConflictWarning
                date={input.eventDate}
                endDate={input.endDate || undefined}
                startTime={input.ceremonyTime || undefined}
                spaceId={input.spaceId || undefined}
                type="event"
                onStatusChange={setDateBlocked}
              />
            )}
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ceremony time" htmlFor="ct">
            <Input id="ct" type="time" value={input.ceremonyTime} onChange={(e) => set("ceremonyTime", e.target.value)} />
          </Field>
          <Field label="Reception time" htmlFor="rt">
            <Input id="rt" type="time" value={input.receptionTime} onChange={(e) => set("receptionTime", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {linkedEventId ? (
            <ManagedOnEventField label="Estimated guests" value={input.guestCount} eventId={linkedEventId} />
          ) : (
            <Field label="Estimated guests" htmlFor="gc" error={errors.guestCount}>
              <Input id="gc" type="number" value={input.guestCount} onChange={(e) => set("guestCount", e.target.value)} placeholder="150" />
            </Field>
          )}
          <Field label="Rehearsal date" htmlFor="rh" error={errors.rehearsalDate}>
            <Input id="rh" type="date" value={input.rehearsalDate} onChange={(e) => set("rehearsalDate", e.target.value)} />
          </Field>
        </div>
      </div>
      <Separator />
      <Field label="Internal notes" htmlFor="notes" hint="Not visible to the client.">
        <Textarea id="notes" value={input.internalNotes} rows={3} onChange={(e) => set("internalNotes", e.target.value)} placeholder="Operational notes…" />
      </Field>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={onSubmit} disabled={pending || dateBlocked}
          title={dateBlocked ? "This date is unavailable." : undefined}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}
