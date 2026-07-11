"use client";

import * as React from "react";

import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { applyTimelineTemplateAction } from "@/app/(app)/timeline-templates/booking-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TimelineTemplate } from "@/lib/timeline-templates/types";

/** The venue's marked default for this event type + space, degrading gracefully to a less specific default rather than inventing one the venue hasn't set. Mirrors resolveDefaultTemplateId in booking-setup-card.tsx. */
function resolveDefaultTimelineTemplateId(templates: TimelineTemplate[], eventType: string | null, spaceId: string | null): string | undefined {
  const defaults = templates.filter((t) => t.isDefault);
  return (
    defaults.find((t) => t.eventType === eventType && t.spaceId === spaceId)
    ?? defaults.find((t) => t.eventType === eventType && !t.spaceId)
    ?? defaults.find((t) => !t.eventType && t.spaceId === spaceId)
    ?? defaults.find((t) => !t.eventType && !t.spaceId)
  )?.id;
}

/**
 * Shown once, on a booking with no Timeline yet — disappears permanently as
 * soon as the Booking has any timeline entries, applied or hand-built
 * (Timeline Templates → Bookings connection, 2026-07-10). Independent of
 * BookingSetupCard's Planning gating — a booking can have Planning applied
 * with no Timeline yet, or vice versa.
 */
export function TimelineSetupCard({
  eventId, eventType, spaceId, eventStartTime, templates, hasTimeline, onApplied,
}: {
  eventId: string;
  eventType: string | null;
  spaceId: string | null;
  eventStartTime: string | null;
  templates: TimelineTemplate[];
  hasTimeline: boolean;
  onApplied: () => void;
}) {
  const preselectId = resolveDefaultTimelineTemplateId(templates, eventType, spaceId);
  const [selectedTemplate, setSelectedTemplate] = React.useState(preselectId ?? templates[0]?.id ?? "");
  const [applying, startApply] = React.useTransition();

  if (hasTimeline || templates.length === 0) return null;

  function handleApply() {
    if (!selectedTemplate) return;
    startApply(async () => {
      const result = await applyTimelineTemplateAction(eventId, selectedTemplate, eventStartTime);
      if (result.ok) { toast.success("Timeline applied."); onApplied(); }
      else toast.error(result.message ?? "Could not apply timeline template.");
    });
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Set up this booking&apos;s timeline</CardTitle>
        <CardDescription>Apply a starting run-of-show — fully editable after, and never linked back to the template.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2">
          <span className="text-sm">🕒</span>
          <p className="text-xs text-muted-foreground flex-1">No timeline applied</p>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate} items={templates.map((t) => ({ value: t.id, label: t.name }))}>
            <SelectTrigger className="h-7 w-40 text-xs shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" size="sm" onClick={handleApply} disabled={applying} className="h-7 px-2 text-xs shrink-0">
            {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="mr-1 h-3 w-3" />Apply</>}
          </Button>
        </div>
        {!eventStartTime && (
          <p className="mt-2 text-[11px] text-muted-foreground">No start time set yet — times will be calculated from noon until you add one.</p>
        )}
      </CardContent>
    </Card>
  );
}
