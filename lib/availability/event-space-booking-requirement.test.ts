import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Start booking file Event Space requirement", () => {
  it("requires Event Space on Booked when the venue allows overlapping events and the Lead has a date", () => {
    const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    assert.match(
      detail,
      /spaceNeededForBooked = maxSimultaneousEvents >= 2 && !!lead\.eventDate/,
    );
    assert.match(detail, /Assign an Event Space before moving to Booked/);
    assert.match(detail, /Add an Event Space in Availability settings/);
  });

  it("service_role can privilege-access venue_spaces without changing RLS", () => {
    const mig = readFileSync(
      resolve("supabase/migrations/20261395000000_availability_tables_service_role_grant.sql"),
      "utf8",
    );
    assert.match(mig, /grant select, insert, update, delete on public\.venue_spaces to service_role/);
    assert.doesNotMatch(mig, /drop policy/i);
    assert.doesNotMatch(mig, /disable row level security/i);
  });
});
