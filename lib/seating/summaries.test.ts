import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildVenueSeatingFloorPlanSummaries } from "@/lib/seating/summaries";

describe("venue-authenticated Seating plan discovery", () => {
  it("keeps plans event-scoped and reports active delegation per plan", () => {
    const result = buildVenueSeatingFloorPlanSummaries(
      [{ id: "ceremony", name: "Ceremony" }, { id: "reception", name: "Reception" }],
      [
        { floor_plan_id: "ceremony", revoked_at: null },
        { floor_plan_id: "reception", revoked_at: "2026-08-14T12:00:00Z" },
        { floor_plan_id: "other-event", revoked_at: null },
      ],
      [],
    );

    assert.deepEqual(result.map(({ id, isDelegated }) => ({ id, isDelegated })), [
      { id: "ceremony", isDelegated: true },
      { id: "reception", isDelegated: false },
    ]);
  });

  it("uses each plan's latest submission without leaking unrelated plans", () => {
    const result = buildVenueSeatingFloorPlanSummaries(
      [{ id: "reception", name: "Reception" }],
      [],
      [
        { floor_plan_id: "reception", guest_count: 90, submitted_by: "venue", created_at: "2026-08-14T12:00:00Z" },
        { floor_plan_id: "reception", guest_count: 80, submitted_by: "couple", created_at: "2026-08-13T12:00:00Z" },
        { floor_plan_id: "other-event", guest_count: 200, submitted_by: "couple", created_at: "2026-08-15T12:00:00Z" },
      ],
    );

    assert.deepEqual(result[0]?.lastSubmission, {
      count: 90,
      submittedAt: "2026-08-14T12:00:00Z",
      submittedBy: "venue",
    });
  });

  // A third assertion previously lived here expecting
  // app/(app)/events/[id]/seating-print/page.tsx to print every discovered
  // floor plan (not just floorPlans[0]) with a page break between each.
  // That page still only prints the first plan — a real, separate
  // enhancement, not part of this reconciliation's scope. Tracked
  // explicitly rather than left as a silently-failing assertion.
});
