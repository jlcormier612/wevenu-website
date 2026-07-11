"use client";

import { PlaybookApplyRow } from "@/components/playbooks/event-task-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAYBOOK_KINDS } from "@/lib/playbooks/constants";
import type { EventPlaybookApplication, EventReadiness, PlaybookKind, PlaybookTemplate } from "@/lib/playbooks/types";

/** The venue's marked default for this kind, matching the event's type if possible — falls back to a kind-wide default with no event type set. Doesn't invent a default where the venue hasn't set one. */
function resolveDefaultTemplateId(templates: PlaybookTemplate[], kind: PlaybookKind, eventType: string | null): string | undefined {
  const defaultsForKind = templates.filter((t) => t.kind === kind && t.isDefault);
  const matchingEventType = eventType ? defaultsForKind.find((t) => t.eventType === eventType) : undefined;
  return (matchingEventType ?? defaultsForKind.find((t) => !t.eventType))?.id;
}

/**
 * Shown once, on a freshly-created booking, before any Planning has been
 * applied — reuses the exact same picker/apply mechanism already used inside
 * the Planning tab (PlaybookApplyRow), just surfaced earlier so a booking
 * starts working immediately instead of sitting empty until someone opens
 * Planning. Disappears permanently once any Planning (client or venue) has
 * been applied to this event.
 */
export function BookingSetupCard({
  eventId, clientId, eventDate, eventName, clientName, eventType,
  templates, applications, readinessByKind, portalToken, onApplied,
}: {
  eventId: string;
  clientId: string | null;
  eventDate: string;
  eventName: string;
  clientName: string | null;
  eventType: string | null;
  templates: PlaybookTemplate[];
  applications: EventPlaybookApplication[];
  readinessByKind: { client: EventReadiness | null; venue: EventReadiness | null };
  portalToken: string | null;
  onApplied: () => void;
}) {
  if (applications.length > 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Set up this booking</CardTitle>
        <CardDescription>Apply your starting checklists — everything stays fully editable after.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {PLAYBOOK_KINDS.map((k) => {
          const kindTemplates = templates.filter((t) => t.kind === k.value);
          return (
            <PlaybookApplyRow
              key={k.value}
              kind={k.value}
              eventId={eventId} clientId={clientId} eventDate={eventDate} eventName={eventName}
              clientName={clientName} eventType={eventType}
              templates={kindTemplates}
              application={applications.find((a) => a.kind === k.value)}
              preselectTemplateId={resolveDefaultTemplateId(templates, k.value, eventType)}
              readiness={k.value === "client" ? readinessByKind.client : readinessByKind.venue}
              portalToken={portalToken}
              onApplied={onApplied}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
