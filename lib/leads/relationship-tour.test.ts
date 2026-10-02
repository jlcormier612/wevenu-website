import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  resolveLeadTourWrite,
  TOUR_TIME_REQUIRED,
} from "@/lib/leads/relationship-tour";
import { occupyingTour } from "@/lib/tours/occupancy";

const occupying = {
  id: "appt-1",
  status: "scheduled",
  scheduledAt: "2099-06-15T14:00:00.000Z",
  origin: "scheduled",
} as const;

const confirmed = { ...occupying, status: "confirmed" } as const;

describe("resolveLeadTourWrite — Phase 2 intents", () => {
  it("date + time schedules a future tour", () => {
    assert.deepEqual(
      resolveLeadTourWrite({
        tourDate: "2099-06-15",
        tourTime: "10:00",
        tourCompleted: false,
        tourNotes: "",
        existing: null,
      }),
      { action: "future_schedule", tourDate: "2099-06-15", tourTime: "10:00", notes: "" },
    );
  });

  it("date only cannot create or update a real Tour appointment", () => {
    assert.deepEqual(
      resolveLeadTourWrite({
        tourDate: "2099-06-15",
        tourTime: "",
        tourCompleted: false,
        tourNotes: "",
        existing: null,
      }),
      { action: "reject", message: TOUR_TIME_REQUIRED },
    );
  });

  it("no date clears an occupying Tour", () => {
    assert.deepEqual(
      resolveLeadTourWrite({
        tourDate: "",
        tourTime: "10:00",
        tourCompleted: false,
        tourNotes: "",
        existing: occupying,
      }),
      { action: "clear" },
    );
  });

  it("no date is a noop when there is no occupying tour", () => {
    assert.deepEqual(
      resolveLeadTourWrite({
        tourDate: "",
        tourTime: "",
        tourCompleted: false,
        tourNotes: "",
        existing: null,
      }),
      { action: "noop" },
    );
  });

  it("completing an occupying tour is complete_scheduled (preserves schedule)", () => {
    assert.deepEqual(
      resolveLeadTourWrite({
        tourDate: "2099-06-15",
        tourTime: "11:30",
        tourCompleted: true,
        tourNotes: "Early",
        existing: occupying,
      }),
      {
        action: "complete_scheduled",
        appointmentId: "appt-1",
        actualDate: "2099-06-15",
        actualTime: "11:30",
        notes: "Early",
      },
    );
    assert.deepEqual(
      resolveLeadTourWrite({
        tourDate: "2099-06-16",
        tourTime: "09:00",
        tourCompleted: true,
        tourNotes: "",
        existing: confirmed,
      }).action,
      "complete_scheduled",
    );
  });

  it("completed with no occupying tour is a walk-in (new row)", () => {
    assert.deepEqual(
      resolveLeadTourWrite({
        tourDate: "2099-06-15",
        tourTime: "14:00",
        tourCompleted: true,
        tourNotes: "Walk-in",
        existing: null,
      }),
      { action: "walk_in", actualDate: "2099-06-15", actualTime: "14:00", notes: "Walk-in" },
    );
  });

  it("editing actual on an already-completed row is actual_only", () => {
    assert.deepEqual(
      resolveLeadTourWrite({
        tourDate: "2099-06-15",
        tourTime: "15:00",
        tourCompleted: true,
        tourNotes: "",
        existing: {
          id: "appt-2",
          status: "completed",
          scheduledAt: "2099-06-15T14:00:00.000Z",
          origin: "scheduled",
        },
      }).action,
      "actual_only",
    );
  });
});

describe("Phase 2 occupancy mirror", () => {
  it("matches DB: scheduled/confirmed occupy only when scheduled_at is present", () => {
    assert.equal(occupyingTour("scheduled"), true);
    assert.equal(occupyingTour("confirmed"), true);
    assert.equal(occupyingTour("scheduled", "2099-06-15T10:00:00Z"), true);
    assert.equal(occupyingTour("scheduled", null), false);
    assert.equal(occupyingTour("confirmed", null), false);
    assert.equal(occupyingTour("completed"), false);
    assert.equal(occupyingTour("no_show"), false);
    assert.equal(occupyingTour("cancelled"), false);
    assert.equal(occupyingTour("completed", null), false);
  });
});

describe("Phase 2 Relationship / ConflictWarning / calendar seams", () => {
  const repo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
  const card = readFileSync(resolve("components/leads/relationship-card.tsx"), "utf8");
  const warning = readFileSync(resolve("components/availability/conflict-warning.tsx"), "utf8");
  const service = readFileSync(resolve("lib/leads/service.ts"), "utf8");
  const calendar = readFileSync(resolve("lib/tours/service.ts"), "utf8");
  const occupancy = readFileSync(resolve("lib/tours/occupancy.ts"), "utf8");
  const focus = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");

  it("follow-up persists before tour write; capacity returns structured conflict", () => {
    const updateFn = repo.slice(repo.indexOf("export async function updateRelationshipFields"));
    const followIdx = updateFn.indexOf('.from("leads")');
    const tourIdx = updateFn.indexOf("applyLeadTourWrite");
    assert.ok(followIdx >= 0 && tourIdx > followIdx, "follow-up write must precede tour apply");
    assert.match(updateFn, /tourConflict/);
    assert.match(service, /tourConflict/);
    assert.match(card, /result\.tourConflict/);
    assert.match(card, /must not disable Save/);
  });

  it("date-only Tour is refused before the lead row is written", () => {
    const updateFn = repo.slice(repo.indexOf("export async function updateRelationshipFields"));
    const rejectIdx = updateFn.indexOf('preview.action === "reject"');
    const leadUpdateIdx = updateFn.indexOf('.from("leads")');
    assert.ok(rejectIdx >= 0 && rejectIdx < leadUpdateIdx);
  });

  it("ConflictWarning clears blocked state on unmount", () => {
    assert.match(warning, /onStatusChange\?\.\(false\)/);
    assert.match(card, /setTourDateBlocked\(false\)/);
  });

  it("completion and walk-in paths never write scheduled_at on complete", () => {
    const applyFn = repo.slice(repo.indexOf("export async function applyLeadTourWrite"));
    assert.match(applyFn, /action === "complete_scheduled"/);
    assert.match(applyFn, /origin: "walk_in"/);
    assert.match(applyFn, /scheduled_at: null/);
    // complete_scheduled update must not include scheduled_at assignment
    const completeBlock = applyFn.slice(
      applyFn.indexOf('decision.action === "complete_scheduled"'),
      applyFn.indexOf('decision.action === "actual_only"'),
    );
    assert.doesNotMatch(completeBlock, /scheduled_at:/);
    assert.match(completeBlock, /actual_occurred_at:/);
  });

  it("calendar projects occupying from scheduled_at and completed/walk-ins from actual_occurred_at", () => {
    const calFn = calendar.slice(calendar.indexOf("export async function getTourCalendarEntries"));
    assert.match(calFn, /origin\.eq\.walk_in,status\.eq\.completed/);
    assert.match(calFn, /actual_occurred_at/);
    assert.match(calFn, /Walk-in/);
    assert.match(calFn, /status === "completed" && t\.actual_occurred_at/);
  });

  it("app occupancy mirror documents null scheduled_at as non-occupying", () => {
    assert.match(occupancy, /scheduledAt === null/);
    assert.match(occupancy, /walk-ins do not consume/);
  });

  it("Focus tour window still keys off scheduled_at (walk-ins excluded by null)", () => {
    assert.match(focus, /gte\("scheduled_at", tourWindowStart\)/);
  });

  it("updateTourStatus writes completion-state only — never scheduled_at or actual_occurred_at", () => {
    const updateFn = calendar.slice(
      calendar.indexOf("export async function updateTourStatus"),
      calendar.indexOf("export async function requestTourConfirmation"),
    );
    const patchBlock = updateFn.slice(
      updateFn.indexOf("const patch:"),
      updateFn.indexOf(".update(patch)"),
    );
    assert.match(patchBlock, /status === "completed"/);
    assert.match(patchBlock, /patch\.completed_at/);
    assert.doesNotMatch(patchBlock, /scheduled_at:/);
    assert.doesNotMatch(patchBlock, /actual_occurred_at/);
  });

  it("Relationship UI requires time when a Tour date is set, and still allows clearing", () => {
    assert.match(card, /tourDateOnly/);
    assert.match(card, /A tour time is required to schedule a venue tour/);
    assert.match(card, /disabled=\{pending \|\| tourDateOnly\}/);
    assert.doesNotMatch(card, /futureScheduleHardBlock/);
  });
});
