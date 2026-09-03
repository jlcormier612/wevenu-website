import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { rowToClientInput } from "@/lib/import/utils";

describe("dated Event import fidelity", () => {
  it("CSV Import rowToClientInput preserves endDate, times, and space", () => {
    const input = rowToClientInput(
      {
        "Partner 1 First Name": "Emma",
        "Partner 1 Last Name": "Johnson",
        "Event Date (YYYY-MM-DD)": "2027-06-12",
        "Event End Date (YYYY-MM-DD)": "2027-06-13",
        "Start Time (HH:MM)": "16:00",
        "End Time (HH:MM)": "22:00",
        "Setup Time (HH:MM)": "14:00",
        "Teardown Time (HH:MM)": "23:00",
        "Event Space Name": "Ballroom",
      },
      {
        firstName: "Partner 1 First Name",
        lastName: "Partner 1 Last Name",
        eventDate: "Event Date (YYYY-MM-DD)",
        endDate: "Event End Date (YYYY-MM-DD)",
        ceremonyTime: "Start Time (HH:MM)",
        receptionTime: "End Time (HH:MM)",
        setupTime: "Setup Time (HH:MM)",
        teardownTime: "Teardown Time (HH:MM)",
        spaceName: "Event Space Name",
      },
    );
    assert.equal(input.endDate, "2027-06-13");
    assert.equal(input.ceremonyTime, "16:00");
    assert.equal(input.receptionTime, "22:00");
    assert.equal(input.setupTime, "14:00");
    assert.equal(input.teardownTime, "23:00");
    assert.equal(input.spaceId, "Ballroom");
  });

  it("datedEventFromClient maps ClientInput operational fields onto the Event write", () => {
    const clients = readFileSync(join(process.cwd(), "lib/clients/service.ts"), "utf8");
    assert.match(clients, /endTime: input\.receptionTime/);
    assert.match(clients, /setupTime: input\.setupTime/);
    assert.match(clients, /teardownTime: input\.teardownTime/);
    assert.match(clients, /spaceId: input\.spaceId/);
  });

  it("Migration Center toClientInput does not hardcode empty endDate/spaceId/times", () => {
    const migration = readFileSync(join(process.cwd(), "lib/migration/service.ts"), "utf8");
    assert.doesNotMatch(migration, /endDate: ""/);
    assert.doesNotMatch(migration, /ceremonyTime: ""/);
    assert.match(migration, /ceremonyTime: n\.startTime/);
    assert.match(migration, /endDate: n\.endDate/);
  });

  it("historical past Events skip occupancy only as reviewed status=complete, never a silent bypass column", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261323000000_bring_business_cutover.sql"),
      "utf8",
    );
    assert.match(sql, /create or replace function public\.events_enforce_availability/);
    assert.match(sql, /NEW\.status = 'complete'/);
    assert.match(sql, /Import as historical record/);
    assert.match(sql, /book_tour_for_migration/);
    assert.match(sql, /status in \('scheduled', 'confirmed'\)/);
    assert.doesNotMatch(sql, /is_historical_import/);
  });
});
