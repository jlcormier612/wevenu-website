"use client";

import * as React from "react";

import { ConflictWarning } from "@/components/availability/conflict-warning";
import { EventSpaceField } from "@/components/availability/event-space-field";
import { EventSpaceAssignmentsEditor } from "@/components/events/event-space-assignments-editor";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  bookingConfirmationError,
  toConfirmedBookingOccupancy,
  type ConfirmedBookingOccupancy,
} from "@/lib/booking-journey/confirmed-occupancy";
import type { BookingConfirmationDraft, OwnHoldSummary } from "@/lib/booking-journey/confirmation-draft";
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
  const [assignedStaffId, setAssignedStaffId] = React.useState("");

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
    setAssignedStaffId(draft.leadAssignedStaffId ?? "");
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
    onConfirm({
      ...occupancy,
      sourceHoldDates: draft.sourceHoldDates,
      assignedStaffId: assignedStaffId.trim() || null,
    });
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
        className="relative z-10 flex max-h-[min(90vh,42rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="space-y-4 overflow-y-auto p-5">
          <div>
            <h2 id="pipeline-booked-title" className="text-base font-semibold text-heading">
              Confirm this booking
            </h2>
            <p id="pipeline-booked-desc" className="mt-1 text-sm text-muted-foreground">
              Review the dates, spaces, and times for this event.
            </p>
          </div>

          {draft && (draft.ownHolds?.length ?? 0) > 0 ? (
            <section className="rounded-lg border border-border bg-muted/40 px-3 py-2.5" data-testid="booking-current-hold">
              <h3 className="text-sm font-semibold text-heading">Current hold</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This lead already has a hold on the calendar. Update the details below to reflect the final booking.
              </p>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {(draft.ownHolds ?? []).map((hold, index) => (
                  <li key={`${hold.holdDate}-${index}`}>
                    {formatHoldDetail(hold)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {loadError && <p className="text-sm text-destructive">{loadError}</p>}

          {draft && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-heading">Spaces and times</h3>
                  {showAssignments ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose the space and the times it will be used for each part of the event.
                    </p>
                  ) : null}
                </div>
                {showAssignments ? (
                  <EventSpaceAssignmentsEditor
                    spaces={spaces}
                    value={assignments}
                    onChange={setAssignments}
                    uses={relevantUses}
                    withTimes
                  />
                ) : (
                  <div className="space-y-3" data-testid="booking-confirm-space">
                    <EventSpaceField
                      value={spaceId}
                      onChange={setSpaceId}
                      spaces={spaces}
                      spacesRequired={spacesRequired}
                      error={spacesRequired && !spaceId ? formError ?? undefined : undefined}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Event-wide start time" htmlFor="booking-confirm-start">
                        <Input
                          id="booking-confirm-start"
                          data-testid="booking-confirm-start"
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </Field>
                      <Field label="Event-wide end time" htmlFor="booking-confirm-end">
                        <Input
                          id="booking-confirm-end"
                          data-testid="booking-confirm-end"
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </section>

              {eventDate && (
                <ConflictWarning
                  date={eventDate}
                  endDate={eventEndDate || undefined}
                  startTime={showAssignments ? undefined : (startTime || undefined)}
                  endTime={showAssignments ? undefined : (endTime || undefined)}
                  spaceId={(showAssignments ? occupancySpace(assignments, experience.isWeddingSpecific) : spaceId) || undefined}
                  windows={showAssignments ? assignmentWindows(assignments) : undefined}
                  type="event"
                  purpose="booking"
                  excludeLeadId={draft.leadId ?? undefined}
                  onStatusChange={setAvailabilityBlocked}
                />
              )}
              {formError && <p className="text-sm text-destructive">{formError}</p>}

              <section className="rounded-lg border border-border bg-muted/40 px-3 py-2.5" data-testid="booking-team-assignment">
                <h3 className="text-sm font-semibold text-heading">Team assignment</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  The person who handled sales can stay responsible, or you can choose someone else for the booked event. This does not change who is assigned on the lead.
                </p>
                <div className="mt-3">
                  <Field label="Event team member" htmlFor="booking-assigned-staff">
                    <Select
                      value={assignedStaffId || "__unassigned__"}
                      onValueChange={(value) => setAssignedStaffId(value === "__unassigned__" ? "" : value)}
                      items={[
                        { value: "__unassigned__", label: "Unassigned" },
                        ...(draft?.staffOptions ?? []).map((member) => ({ value: member.id, label: member.name })),
                      ]}
                    >
                      <SelectTrigger id="booking-assigned-staff" data-testid="booking-assigned-staff">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                        {(draft?.staffOptions ?? []).map((member) => (
                          <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </section>

              <section className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <h3 className="text-sm font-semibold text-heading">When you confirm</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  The booking will reserve the selected spaces and times on the calendar. Any unused part of this lead&apos;s hold will be released.
                </p>
              </section>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
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
            {confirming ? "Booking…" : "Confirm booking"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function occupancySpace(assignments: EventSpaceAssignmentInput[], weddingFamily: boolean): string {
  return primarySpaceIdFromAssignments(assignments, { weddingFamily }) ?? "";
}

function assignmentWindows(assignments: EventSpaceAssignmentInput[]) {
  return assignments
    .filter((row) => row.spaceId.trim())
    .map((row) => ({
      spaceId: row.spaceId,
      startTime: row.startTime ?? null,
      endTime: row.endTime ?? null,
    }));
}

function formatHoldDetail(hold: OwnHoldSummary): string {
  const date = formatHoldDate(hold.holdDate);
  const start = formatClock(hold.startTime);
  const end = formatClock(hold.endTime);
  const time = start && end ? `${start}–${end}` : "All day";
  const scope = hold.wholeVenue ? "Whole venue" : (hold.spaceLabel ?? "Selected spaces");
  return `${date} · ${time} · ${scope}`;
}

function formatHoldDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatClock(value: string | null): string | null {
  if (!value) return null;
  const [hourText, minute] = value.slice(0, 5).split(":");
  const hour = Number(hourText);
  if (!minute || Number.isNaN(hour)) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}
