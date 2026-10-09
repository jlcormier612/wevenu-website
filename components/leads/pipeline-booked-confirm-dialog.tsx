"use client";

import * as React from "react";

import { ConflictWarning } from "@/components/availability/conflict-warning";
import { EventSpaceField } from "@/components/availability/event-space-field";
import { EventSpaceAssignmentsEditor } from "@/components/events/event-space-assignments-editor";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  bookingConfirmationError,
  toConfirmedBookingOccupancy,
  type ConfirmedBookingOccupancy,
} from "@/lib/booking-journey/confirmed-occupancy";
import type { BookingConfirmationDraft } from "@/lib/booking-journey/confirmation-draft";
import { resolveExperienceProfile } from "@/lib/event-experience";
import { primarySpaceIdFromAssignments, type EventSpaceAssignmentInput } from "@/lib/venue-spaces/assignments";
import { relevantUsesForExperience } from "@/lib/venue-spaces/relevant-uses";

/**
 * Mandatory confirmation before a manual move to Booked.
 * Prefill is not confirmation. The venue submits the final date, spaces, and times.
 */
export function PipelineBookedConfirmDialog({
  open,
  confirming = false,
  draft,
  loadError = null,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  confirming?: boolean;
  draft: BookingConfirmationDraft | null;
  loadError?: string | null;
  onCancel: () => void;
  onConfirm: (occupancy: ConfirmedBookingOccupancy) => void;
}) {
  const [eventDate, setEventDate] = React.useState("");
  const [eventEndDate, setEventEndDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [spaceId, setSpaceId] = React.useState("");
  const [assignments, setAssignments] = React.useState<EventSpaceAssignmentInput[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [availabilityBlocked, setAvailabilityBlocked] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirming) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, confirming]);

  React.useEffect(() => {
    if (!open || !draft) return;
    setEventDate(draft.eventDate);
    setEventEndDate(draft.eventEndDate);
    setStartTime(draft.startTime);
    setEndTime(draft.endTime);
    setSpaceId(draft.spaceId);
    setAssignments(draft.assignments);
    setFormError(null);
    setAvailabilityBlocked(false);
  }, [open, draft]);

  if (!open) return null;

  const spaces = draft?.spaces ?? [];
  const maxSimultaneousEvents = draft?.maxSimultaneousEvents ?? 1;
  const multi = draft?.spaceOperatingMode === "multi";
  const experience = resolveExperienceProfile(draft?.eventType);
  const relevantUses = multi ? relevantUsesForExperience(spaces, experience) : [];
  const showAssignments = multi && relevantUses.length > 0;
  const spacesRequired = maxSimultaneousEvents >= 2;

  function submit() {
    if (!draft) return;
    const occupancy = toConfirmedBookingOccupancy({
      eventDate,
      eventEndDate,
      startTime,
      endTime,
      spaceId: showAssignments ? "" : spaceId,
      assignments: showAssignments ? assignments : [],
      weddingFamily: experience.isWeddingSpecific,
    });
    const message = bookingConfirmationError(occupancy, maxSimultaneousEvents);
    if (message) {
      setFormError(message);
      return;
    }
    setFormError(null);
    if (availabilityBlocked) return;
    onConfirm({ ...occupancy, sourceHoldDates: draft.sourceHoldDates });
  }

  const chosenSpace = showAssignments
    ? occupancySpace(assignments, experience.isWeddingSpecific)
    : spaceId;
  const missingRequiredSpace = spacesRequired && !chosenSpace;
  const blocked = !draft || !!loadError;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        disabled={confirming}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pipeline-booked-title"
        aria-describedby="pipeline-booked-desc"
        data-testid="booking-confirmation"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="pipeline-booked-title" className="text-base font-semibold text-heading">
          You&apos;re booking this date.
        </h2>
        <div id="pipeline-booked-desc" className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            Confirm the final event dates, spaces, and times. These will become the booked event and determine availability according to your venue&apos;s booking rules.
          </p>
          {draft?.hasOwnActiveHold ? (
            <p>
              This lead already has a hold. Confirming establishes the booking from the dates, spaces, and times shown here. That hold is not a conflict with someone else.
            </p>
          ) : null}
          {draft && !draft.holdBlocksAvailability ? (
            <p>
              Holds do not reserve availability under your current settings. A confirmed booking will affect availability according to your booking rules.
            </p>
          ) : null}
          {draft?.holdBlocksAvailability && draft.hasOwnActiveHold ? (
            <p>
              Holds can make availability unavailable to other bookings. This lead&apos;s own hold is handled as part of converting them to a booking.
            </p>
          ) : null}
        </div>

        {loadError && <p className="mt-3 text-sm text-destructive">{loadError}</p>}

        {draft && (
          <div className="mt-4 space-y-4">
            <Field label="Event date" htmlFor="booking-confirm-date" required>
              <Input
                id="booking-confirm-date"
                data-testid="booking-confirm-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </Field>
            <Field
              label="End date"
              htmlFor="booking-confirm-end-date"
              hint="Leave blank for a single-day event."
            >
              <Input
                id="booking-confirm-end-date"
                data-testid="booking-confirm-end-date"
                type="date"
                value={eventEndDate}
                min={eventDate || undefined}
                onChange={(e) => setEventEndDate(e.target.value)}
              />
            </Field>
            {showAssignments ? (
              <EventSpaceAssignmentsEditor
                spaces={spaces}
                value={assignments}
                onChange={setAssignments}
                uses={relevantUses}
              />
            ) : (
              <div data-testid="booking-confirm-space">
                <EventSpaceField
                  value={spaceId}
                  onChange={setSpaceId}
                  spaces={spaces}
                  spacesRequired={spacesRequired}
                  error={spacesRequired && !spaceId ? formError ?? undefined : undefined}
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start time" htmlFor="booking-confirm-start">
                <Input
                  id="booking-confirm-start"
                  data-testid="booking-confirm-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
              <Field label="End time" htmlFor="booking-confirm-end">
                <Input
                  id="booking-confirm-end"
                  data-testid="booking-confirm-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave the times blank for an all-day booking.
            </p>
            {eventDate && (
              <ConflictWarning
                date={eventDate}
                endDate={eventEndDate || undefined}
                startTime={startTime || undefined}
                endTime={endTime || undefined}
                spaceId={(showAssignments ? occupancySpace(assignments, experience.isWeddingSpecific) : spaceId) || undefined}
                type="event"
                purpose="booking"
                excludeLeadId={draft.leadId ?? undefined}
                onStatusChange={setAvailabilityBlocked}
              />
            )}
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" autoFocus disabled={confirming} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            data-testid="booking-confirm-submit"
            disabled={confirming || blocked || availabilityBlocked || !eventDate.trim() || missingRequiredSpace}
            onClick={submit}
          >
            {confirming ? "Booking…" : "Mark as Booked"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function occupancySpace(assignments: EventSpaceAssignmentInput[], weddingFamily: boolean): string {
  return primarySpaceIdFromAssignments(assignments, { weddingFamily }) ?? "";
}
