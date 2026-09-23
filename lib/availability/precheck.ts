/**
 * K.7 Phase 5 — user-facing availability pre-check.
 *
 * Database triggers remain write-path authority. This module builds the
 * ConflictWarning payload so the UI does not say "available" / "advisory
 * only" when the subsequent write will necessarily refuse.
 *
 * Event → Tour conflict uses Phase 2 operational-window overlap on each
 * protected Event day (setup/start → end/teardown). It is not a date-only
 * closure. Tours and Events remain separate capacity domains.
 */

import {
  coveringCalendarBlockTitle,
  eventCoverageInterval,
  tourCoverageInterval,
  TOUR_CLOSING_CALENDAR_BLOCK_TYPES,
  type CalendarBlockCoverageInput,
} from "@/lib/availability/calendar-block-coverage";
import {
  effectiveMaxSimultaneousEvents,
  effectiveMinTurnaroundHours,
  eventOccupancyOverlapsTour,
  evaluateEventOccupancy,
  isInquiryEventDateAvailable,
  type OccupancyCode,
  type OccupancyEvent,
} from "@/lib/availability/event-occupancy";
import type { AvailabilityStatus, ConflictItem, ConflictType } from "@/lib/availability/types";
import {
  effectiveMaxSimultaneousTours,
  evaluateTourCapacity,
  tourFitsAvailabilityWindow,
  utcClockFromMs,
  type TourInterval,
  type TourWindow,
} from "@/lib/tours/occupancy";
import { utcToVenueLocalParts } from "@/lib/venue/timezone";

export { TOUR_CLOSING_CALENDAR_BLOCK_TYPES };

export type AvailabilityCheckPurpose = "booking" | "preferred_date";

export type AvailabilityCheckInput = {
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  setupTime?: string;
  teardownTime?: string;
  spaceId?: string;
  type: "event" | "tour";
  excludeId?: string;
  /**
   * booking — Event write pre-check (space required when simultaneous).
   * preferred_date — Lead/inquiry preferred date (date-level; does not require a space).
   */
  purpose?: AvailabilityCheckPurpose;
  /** Venue-local Tour start as UTC ms. Omit when no tour time is known. */
  tourScheduledAtMs?: number;
  tourDurationMinutes?: number;
  /** IANA venue timezone. Event TIME and tour windows are venue-local. */
  timezone?: string | null;
};

export type AvailabilityCheckTour = TourInterval & { leadId?: string | null };

export type AvailabilityCheckSnapshot = {
  calendarBlocks: CalendarBlockCoverageInput[];
  holdCount: number;
  /**
   * When true (venue default), active Holds refuse Event booking — same as
   * venues.hold_blocks_availability / events_enforce_availability.
   */
  holdBlocksAvailability?: boolean;
  /** When true, a tour may overlap a booked event. Default false. */
  allowToursDuringBookedEvents?: boolean;
  rules: { maxSimultaneousEvents?: number | null; maxSimultaneousTours?: number | null; minTurnaroundHours?: number | null } | null;
  events: OccupancyEvent[];
  activeSpaceIds: string[];
  allSpaceIds: string[];
  tours: AvailabilityCheckTour[];
  tourExceptionLabel?: string | null;
  tourWindows?: TourWindow[];
};

export function occupancyConflictType(code: OccupancyCode): ConflictType {
  if (code === "venue_at_capacity") return "event_capacity_full";
  if (code === "space_overlap") return "space_booked";
  if (code === "event_turnaround") return "event_turnaround";
  return "event_occupancy";
}

function pushBlock(conflicts: ConflictItem[], title: string) {
  conflicts.push({
    type: "calendar_blocked",
    message: `This date is blocked on the calendar: ${title}.`,
    severity: "error",
  });
}

export function buildAvailabilityConflicts(
  input: AvailabilityCheckInput,
  snapshot: AvailabilityCheckSnapshot,
): AvailabilityStatus {
  const conflicts: ConflictItem[] = [];

  const tourClock = input.type === "tour" && input.tourScheduledAtMs != null
    ? (input.timezone
      ? utcToVenueLocalParts(new Date(input.tourScheduledAtMs).toISOString(), input.timezone)
      : utcClockFromMs(input.tourScheduledAtMs))
    : null;
  const blockInterval = input.type === "event"
    ? eventCoverageInterval({
      eventDate: input.date,
      eventEndDate: input.endDate,
      setupTime: input.setupTime,
      startTime: input.startTime,
      endTime: input.endTime,
      teardownTime: input.teardownTime,
    })
    : tourCoverageInterval({
      date: tourClock?.date ?? input.date,
      startTime: tourClock?.time ?? input.startTime,
      durationMinutes: input.tourDurationMinutes,
    });
  const coveringTitle = coveringCalendarBlockTitle(
    snapshot.calendarBlocks,
    blockInterval,
    input.type === "tour" ? { types: TOUR_CLOSING_CALENDAR_BLOCK_TYPES } : undefined,
  );
  if (coveringTitle) pushBlock(conflicts, coveringTitle);

  if (snapshot.holdCount > 0) {
    const holdBlocks = snapshot.holdBlocksAvailability !== false;
    if (holdBlocks) {
      conflicts.push({
        type: "hold_exists",
        message: "This date has a hold. Your availability settings treat holds as unavailable.",
        severity: "error",
      });
    } else {
      conflicts.push({
        type: "hold_exists",
        message: snapshot.holdCount === 1
          ? "There is a hold on this date. Your settings do not treat holds as unavailable."
          : `There are ${snapshot.holdCount} holds on this date. Your settings do not treat holds as unavailable.`,
        severity: "warning",
      });
    }
  }

  if (input.type === "event") {
    const venueOccupancy = {
      effectiveMax: effectiveMaxSimultaneousEvents(snapshot.rules),
      minTurnaroundHours: effectiveMinTurnaroundHours(snapshot.rules),
      activeSpaceIds: snapshot.activeSpaceIds,
      allSpaceIds: snapshot.allSpaceIds,
    };
    const purpose = input.purpose ?? "booking";
    if (purpose === "preferred_date" && !input.spaceId?.trim()) {
      // Lead / inquiry preferred dates are date-level — do not require a space.
      // Simultaneous venues: available when any active space would accept a full-day Event.
      if (!isInquiryEventDateAvailable(input.date, venueOccupancy, snapshot.events)) {
        const simultaneous = venueOccupancy.effectiveMax >= 2;
        conflicts.push({
          type: simultaneous && venueOccupancy.activeSpaceIds.length === 0
            ? "event_occupancy"
            : "event_capacity_full",
          message: simultaneous && venueOccupancy.activeSpaceIds.length === 0
            ? "Add an Event Space in Availability settings before booking. This venue can host more than one event at the same time."
            : "This date is already booked for an overlapping event.",
          severity: "error",
        });
      }
    } else {
      const occupancy = evaluateEventOccupancy(
        {
          eventDate: input.date,
          eventEndDate: input.endDate,
          spaceId: input.spaceId,
          setupTime: input.setupTime,
          startTime: input.startTime,
          endTime: input.endTime,
          teardownTime: input.teardownTime,
          excludeEventId: input.excludeId,
        },
        venueOccupancy,
        snapshot.events,
      );
      if (!occupancy.ok) {
        conflicts.push({
          type: occupancyConflictType(occupancy.code),
          message: occupancy.message,
          severity: "error",
        });
      }
    }
  } else if (input.tourScheduledAtMs != null) {
    const duration = input.tourDurationMinutes && input.tourDurationMinutes > 0
      ? input.tourDurationMinutes
      : 60;
    const clock = input.timezone
      ? utcToVenueLocalParts(new Date(input.tourScheduledAtMs).toISOString(), input.timezone)
      : utcClockFromMs(input.tourScheduledAtMs);

    if (snapshot.tourWindows) {
      if (!tourFitsAvailabilityWindow({
        date: clock.date,
        startTime: clock.time,
        durationMinutes: duration,
        windows: snapshot.tourWindows,
      })) {
        conflicts.push({
          type: "tour_outside_window",
          message: "This time is outside the venue's tour hours.",
          severity: "error",
        });
      }
    }

    const overlappingEvent = snapshot.events.find((e) =>
      eventOccupancyOverlapsTour(e, {
        date: clock.date,
        startTime: clock.time,
        durationMinutes: duration,
      }),
    );
    if (overlappingEvent && snapshot.allowToursDuringBookedEvents !== true) {
      conflicts.push({
        type: "tour_event_overlap",
        message: "This tour time overlaps a booked event.",
        severity: "error",
      });
    }

    if (snapshot.tourExceptionLabel !== undefined && snapshot.tourExceptionLabel !== null) {
      const extra = snapshot.tourExceptionLabel.trim();
      conflicts.push({
        type: "tour_exception",
        message: extra
          ? `Tours are not offered on this date (${extra}).`
          : "Tours are not offered on this date.",
        severity: "error",
      });
    }

    const existing = snapshot.tours.filter((t) => {
      if (input.excludeId && t.leadId === input.excludeId) return false;
      return true;
    });
    const capacity = evaluateTourCapacity({
      rules: snapshot.rules,
      existing,
      candidate: {
        scheduledAtMs: input.tourScheduledAtMs,
        durationMinutes: duration,
        status: "scheduled",
      },
    });
    if (!capacity.ok) {
      const max = effectiveMaxSimultaneousTours(snapshot.rules);
      conflicts.push({
        type: "tour_capacity_full",
        message: `Maximum simultaneous tours (${max}) reached for this time.`,
        severity: "error",
      });
    }
  } else if (snapshot.tourExceptionLabel !== undefined && snapshot.tourExceptionLabel !== null) {
    const extra = snapshot.tourExceptionLabel.trim();
    conflicts.push({
      type: "tour_exception",
      message: extra
        ? `Tours are not offered on this date (${extra}).`
        : "Tours are not offered on this date.",
      severity: "error",
    });
  }

  return {
    available: conflicts.filter((c) => c.severity === "error").length === 0,
    conflicts,
  };
}
