import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const service = readFileSync(resolve("lib/leads/service.ts"), "utf8");
const repo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const actions = readFileSync(resolve("app/(app)/leads/[id]/actions.ts"), "utf8");
const booking = readFileSync(resolve("app/(app)/booking-journey/actions.ts"), "utf8");
const sql = readFileSync(
  resolve("supabase/migrations/20261405600000_lead_planned_event_space.sql"),
  "utf8",
);

const setter = service.slice(service.indexOf("export async function setLeadPlannedEventSpace"));
const bookMove = service.slice(service.indexOf("export async function confirmPipelineBookedMove"));

describe("planned event space persistence", () => {
  it("stores the planning choice on leads, not a new table or Event", () => {
    assert.match(sql, /alter table public\.leads/);
    assert.match(sql, /planned_event_space_id uuid/);
    assert.match(sql, /references public\.venue_spaces/);
    assert.doesNotMatch(sql, /insert into public\.events/i);
    assert.match(sql, /does not create an Event/i);
  });

  it("autosaves from the Lead field and reloads from the lead row", () => {
    assert.match(detail, /lead\.plannedEventSpaceId/);
    assert.match(detail, /setLeadPlannedEventSpaceAction/);
    assert.match(detail, /Could not save the event space/);
    assert.match(actions, /setLeadPlannedEventSpaceAction/);
    assert.match(repo, /planned_event_space_id: spaceId/);
    assert.match(repo, /plannedEventSpaceId: r\.planned_event_space_id/);
  });

  it("rejects a space that is not on this venue and allows null", () => {
    assert.match(setter, /venue_spaces/);
    assert.match(setter, /\.eq\("venue_id", venueId\)/);
    assert.match(setter, /That event space is not on this venue/);
    assert.match(setter, /spaceId\?\.trim\(\) \|\| null/);
  });

  it("does not create an Event, change stage, or stamp booked_at when saving the plan", () => {
    const body = setter.slice(0, setter.indexOf("export async function updateLeadInfo"));
    assert.doesNotMatch(body, /from\("events"\)/);
    assert.doesNotMatch(body, /booked_at/);
    assert.doesNotMatch(body, /sales_stage/);
    assert.doesNotMatch(body, /bookClient/);
  });

  it("booking uses the explicit space, otherwise the latest planned space", () => {
    assert.match(bookMove, /opts\?\.spaceId\?\.trim\(\) \|\| lead\.plannedEventSpaceId/);
    assert.match(booking, /spaceId\?\.trim\(\) \|\| lead\.plannedEventSpaceId/);
  });
});
