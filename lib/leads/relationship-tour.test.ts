import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  resolveLeadTourWrite,
  TOUR_TIME_REQUIRED,
} from "@/lib/leads/relationship-tour";

describe("resolveLeadTourWrite", () => {
  it("date + time schedules a Tour with the supplied time", () => {
    assert.deepEqual(
      resolveLeadTourWrite({ tourDate: "2099-06-15", tourTime: "10:00" }),
      { action: "upsert", tourDate: "2099-06-15", tourTime: "10:00" },
    );
  });

  it("date only cannot create or update a real Tour appointment", () => {
    assert.deepEqual(
      resolveLeadTourWrite({ tourDate: "2099-06-15", tourTime: "" }),
      { action: "reject", message: TOUR_TIME_REQUIRED },
    );
    assert.deepEqual(
      resolveLeadTourWrite({ tourDate: "2099-06-15", tourTime: "   " }),
      { action: "reject", message: TOUR_TIME_REQUIRED },
    );
  });

  it("no date clears an existing Tour regardless of leftover time", () => {
    assert.deepEqual(resolveLeadTourWrite({ tourDate: "", tourTime: "" }), { action: "clear" });
    assert.deepEqual(resolveLeadTourWrite({ tourDate: "  ", tourTime: "10:00" }), { action: "clear" });
  });
});

describe("Relationship Venue Tour write seams", () => {
  const repo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
  const card = readFileSync(resolve("components/leads/relationship-card.tsx"), "utf8");
  const service = readFileSync(resolve("lib/leads/service.ts"), "utf8");
  const scheduler = readFileSync(resolve("components/tours/tour-scheduler.tsx"), "utf8");
  const inquiry = readFileSync(resolve("components/form/inquiry-form.tsx"), "utf8");
  const tourPanel = readFileSync(resolve("components/leads/tour-panel.tsx"), "utf8");
  const bookRoute = readFileSync(resolve("app/api/tours/book/route.ts"), "utf8");

  it("does not invent a noon timestamp when time is missing", () => {
    assert.match(repo, /resolveLeadTourWrite/);
    assert.doesNotMatch(repo, /tourTime \|\| ["']12:00["']/);
    assert.doesNotMatch(repo, /input\.tourTime \|\| ["']12:00["']/);
    const updateFn = repo.slice(repo.indexOf("export async function updateRelationshipFields"));
    const rejectIdx = updateFn.indexOf('tourDecision.action === "reject"');
    const leadUpdateIdx = updateFn.indexOf('.from("leads")');
    assert.ok(rejectIdx >= 0 && rejectIdx < leadUpdateIdx, "date-only Tour must be refused before the lead row is written");
  });

  it("Relationship UI requires time when a Tour date is set, and still allows clearing", () => {
    assert.match(card, /tourDateOnly/);
    assert.match(card, /A tour time is required to schedule a venue tour/);
    assert.match(card, /disabled=\{pending \|\| tourDateBlocked \|\| tourDateOnly\}/);
  });

  it("service maps a date-only Tour write to a user-facing refusal", () => {
    assert.match(service, /LeadTourWriteError/);
    assert.match(service, /TOUR_TIME_REQUIRED/);
  });

  it("public Request Information remains an inquiry, not a Tour booking", () => {
    assert.match(inquiry, /mode === "request_information"/);
    assert.match(inquiry, /\/api\/public\/inquire/);
    assert.match(inquiry, /\/api\/tours\/book/);
    const infoHandler = inquiry.slice(
      inquiry.indexOf('if (mode === "request_information")'),
      inquiry.indexOf('} else if (mode === "schedule_tour"'),
    );
    assert.doesNotMatch(infoHandler, /\/api\/tours\/book/);
    assert.match(infoHandler, /\/api\/public\/inquire/);
  });

  it("public and coordinator actual Tour scheduling still require a slot time", () => {
    assert.match(scheduler, /if \(!selectedSlot\) return;/);
    assert.match(scheduler, /slotStart: selectedSlot\.start/);
    assert.match(inquiry, /Please select a tour date and time/);
    assert.match(inquiry, /slotStart: selectedTourSlot\.start/);
    assert.match(bookRoute, /!body\.key \|\| !body\.slotStart/);
    assert.match(tourPanel, /disabled=\{!selectedSlot \|\| saving\}/);
    assert.match(tourPanel, /selectedSlot\.start/);
  });

  it("stamps venues.tour_duration_minutes on create and update, and does not hard-code 60", () => {
    const fnStart = repo.indexOf("export async function upsertLeadTour");
    const fnEnd = repo.indexOf("// ---- row mappers");
    const fn = repo.slice(fnStart, fnEnd);
    assert.match(fn, /select\("timezone, tour_duration_minutes"\)/);
    assert.match(fn, /durationMinutes = Number\(venueRow\?\.tour_duration_minutes\)/);
    assert.match(fn, /durationMinutes <= 0/);
    assert.match(fn, /does not have a tour duration configured/);
    assert.doesNotMatch(fn, /duration_minutes:\s*60/);
    assert.doesNotMatch(fn, /tour_duration_minutes\s*\|\|\s*60/);
    const durationWrites = fn.split("duration_minutes: durationMinutes");
    assert.equal(durationWrites.length, 3, "create and update/reschedule must both stamp duration_minutes from the venue");
    assert.match(fn, /input\.tourCompleted \? "completed" : "scheduled"/);
  });
});
