/**
 * Lead preferred-date availability warning — soft gate on New Lead.
 * Reuses buildAvailabilityConflicts / checkAvailability (preferred_date).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildAvailabilityConflicts } from "@/lib/availability/precheck";
import type { OccupancyEvent } from "@/lib/availability/event-occupancy";

const form = readFileSync(resolve("components/leads/new-inquiry-form.tsx"), "utf8");
const dialog = readFileSync(resolve("components/leads/lead-date-unavailable-dialog.tsx"), "utf8");
const precheck = readFileSync(resolve("lib/availability/precheck.ts"), "utf8");
const repo = readFileSync(resolve("lib/availability/repository.ts"), "utf8");

const emptySnap = {
  calendarBlocks: [] as never[],
  holdCount: 0,
  holdBlocksAvailability: true,
  rules: { maxSimultaneousEvents: 1, maxSimultaneousTours: 1, minTurnaroundHours: 0 },
  events: [] as OccupancyEvent[],
  activeSpaceIds: [] as string[],
  allSpaceIds: [] as string[],
  tours: [] as never[],
};

describe("Lead date availability warning", () => {
  it("New Lead wires preferred_date check and soft override dialog", () => {
    assert.match(form, /checkAvailabilityAction/);
    assert.match(form, /purpose:\s*"preferred_date"/);
    assert.match(form, /LeadDateUnavailableDialog/);
    assert.match(form, /onSaveAnyway/);
    assert.match(dialog, /This date isn&apos;t currently available/);
    assert.match(dialog, /Saving this lead does not reserve or book the date/);
    assert.match(dialog, /Go back/);
    assert.match(dialog, /Save lead anyway/);
    // Never hard-block createLead
    assert.doesNotMatch(form, /disabled=\{pending \|\| date/);
  });

  it("reuses canonical precheck — no parallel Lead-only availability engine", () => {
    assert.match(form, /checkAvailabilityAction/);
    assert.doesNotMatch(form, /from\("date_holds"\)|from\("calendar_blocks"\)/);
    assert.match(precheck, /purpose\?: AvailabilityCheckPurpose/);
    assert.match(precheck, /preferred_date/);
    assert.match(precheck, /isInquiryEventDateAvailable/);
    assert.match(precheck, /holdBlocksAvailability/);
    assert.match(repo, /hold_blocks_availability/);
    assert.match(repo, /booked_at/);
  });

  it("blocked calendar time is an error with human-facing copy", () => {
    const status = buildAvailabilityConflicts(
      { date: "2030-06-01", type: "event", purpose: "preferred_date" },
      {
        ...emptySnap,
        calendarBlocks: [{ title: "Staff training", type: "blocked_time" }],
      },
    );
    assert.equal(status.available, false);
    assert.ok(status.conflicts.some((c) => c.type === "calendar_blocked" && c.severity === "error"));
    assert.match(status.conflicts.find((c) => c.type === "calendar_blocked")!.message, /blocked on the calendar/i);
    assert.doesNotMatch(
      status.conflicts.find((c) => c.type === "calendar_blocked")!.message,
      /blocks_availability|calendar_blocks/i,
    );
  });

  it("booked event occupancy is an error for preferred_date", () => {
    const booked: OccupancyEvent = {
      id: "e1",
      name: "Maya Chen — wedding",
      status: "confirmed",
      eventDate: "2030-07-12",
      eventEndDate: null,
      spaceId: null,
      setupTime: null,
      startTime: null,
      endTime: null,
      teardownTime: null,
    };
    const status = buildAvailabilityConflicts(
      { date: "2030-07-12", type: "event", purpose: "preferred_date" },
      { ...emptySnap, events: [booked] },
    );
    assert.equal(status.available, false);
    assert.ok(status.conflicts.some((c) => c.severity === "error" && /already booked/i.test(c.message)));
  });

  it("blocking Hold is an error when venue hold setting says so", () => {
    const blocked = buildAvailabilityConflicts(
      { date: "2030-08-01", type: "event", purpose: "preferred_date" },
      { ...emptySnap, holdCount: 1, holdBlocksAvailability: true },
    );
    assert.ok(blocked.conflicts.some((c) => c.type === "hold_exists" && c.severity === "error"));
    assert.match(
      blocked.conflicts.find((c) => c.type === "hold_exists")!.message,
      /hold\. Your availability settings treat holds as unavailable/i,
    );

    const soft = buildAvailabilityConflicts(
      { date: "2030-08-01", type: "event", purpose: "preferred_date" },
      { ...emptySnap, holdCount: 1, holdBlocksAvailability: false },
    );
    assert.ok(soft.conflicts.every((c) => c.type !== "hold_exists" || c.severity === "warning"));
  });

  it("available date has no conflicts", () => {
    const status = buildAvailabilityConflicts(
      { date: "2030-09-01", type: "event", purpose: "preferred_date" },
      emptySnap,
    );
    assert.equal(status.available, true);
    assert.equal(status.conflicts.length, 0);
  });

  it("preferred_date does not require a space on simultaneous venues when a space is free", () => {
    const booked: OccupancyEvent = {
      id: "e1",
      name: "Barn wedding",
      status: "confirmed",
      eventDate: "2030-10-10",
      eventEndDate: null,
      spaceId: "space-barn",
      setupTime: null,
      startTime: null,
      endTime: null,
      teardownTime: null,
    };
    const status = buildAvailabilityConflicts(
      { date: "2030-10-10", type: "event", purpose: "preferred_date" },
      {
        ...emptySnap,
        rules: { maxSimultaneousEvents: 2, maxSimultaneousTours: 1, minTurnaroundHours: 0 },
        events: [booked],
        activeSpaceIds: ["space-barn", "space-lawn"],
        allSpaceIds: ["space-barn", "space-lawn"],
      },
    );
    // Lawn still free → preferred date available
    assert.equal(status.available, true);
    assert.equal(status.conflicts.length, 0);
  });
});
