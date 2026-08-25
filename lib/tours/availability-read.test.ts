import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  editorHydrationFromAvailability,
  parseCoordinatorTourAvailability,
} from "@/lib/tours/availability-read";

describe("parseCoordinatorTourAvailability", () => {
  it("maps a successful RPC payload to windows and exceptions", () => {
    const load = parseCoordinatorTourAvailability({
      ok: true,
      windows: [
        { id: "w1", dayOfWeek: 1, startTime: "09:00", endTime: "16:00", sortOrder: 0 },
        { id: "w2", dayOfWeek: 0, startTime: "13:00", endTime: "18:00", sortOrder: 0 },
      ],
      exceptions: [
        { id: "e1", startDate: "2026-09-04", endDate: "2026-09-04", label: "Blocked" },
      ],
    });
    assert.equal(load.ok, true);
    if (!load.ok) return;
    assert.equal(load.windows.length, 2);
    assert.equal(load.windows[0].dayOfWeek, 1);
    assert.equal(load.windows[0].startTime, "09:00");
    assert.equal(load.exceptions[0].startDate, "2026-09-04");
  });

  it("does not treat a failed RPC as an empty schedule", () => {
    const load = parseCoordinatorTourAvailability({ ok: false, error: "unauthorized" });
    assert.equal(load.ok, false);
    const hydrate = editorHydrationFromAvailability(load);
    assert.ok(hydrate.loadError);
    assert.equal(hydrate.windows.length, 0);
    assert.equal(hydrate.exceptions.length, 0);
  });

  it("does not treat a PostgREST error-shaped null payload as empty availability", () => {
    const load = parseCoordinatorTourAvailability(null);
    assert.equal(load.ok, false);
    const hydrate = editorHydrationFromAvailability(load);
    assert.ok(hydrate.loadError);
  });

  it("treats a genuine empty schedule as ok with zero rows", () => {
    const load = parseCoordinatorTourAvailability({ ok: true, windows: [], exceptions: [] });
    assert.equal(load.ok, true);
    const hydrate = editorHydrationFromAvailability(load);
    assert.equal(hydrate.loadError, null);
    assert.equal(hydrate.windows.length, 0);
  });
});

describe("get_coordinator_tour_availability security contract", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261298000000_coordinator_tour_availability_read.sql"),
    "utf8",
  );

  it("does not accept a venue_id argument", () => {
    assert.match(sql, /get_coordinator_tour_availability\(\)/);
    assert.doesNotMatch(sql, /p_venue_id/);
    assert.match(sql, /current_user_venue_id\(\)/);
  });

  it("is not granted to anon", () => {
    assert.match(sql, /revoke all on function public\.get_coordinator_tour_availability\(\) from public, anon/);
    assert.match(sql, /grant execute on function public\.get_coordinator_tour_availability\(\) to authenticated/);
  });
});
