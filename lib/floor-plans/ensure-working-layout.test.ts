import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  resolveExistingCloneId,
  resolveWorkingTemplateId,
} from "@/lib/floor-plans/ensure-working-layout";

describe("ensure-working-layout rules (Phase 2)", () => {
  it("sole offered template becomes the working seed", () => {
    assert.equal(
      resolveWorkingTemplateId({
        offeredTemplateIds: ["t-only"],
        preferredTemplateId: null,
      }),
      "t-only",
    );
  });

  it("multiple offers do not auto-pick preferred or first offer", () => {
    assert.equal(
      resolveWorkingTemplateId({
        offeredTemplateIds: ["t-a", "t-b", "t-c"],
        preferredTemplateId: "t-b",
      }),
      null,
    );
  });

  it("reuses the earliest clone for a source template", () => {
    assert.equal(
      resolveExistingCloneId(
        [
          { id: "later", sourceTemplateId: "t1", createdAt: "2026-08-02T00:00:00Z" },
          { id: "first", sourceTemplateId: "t1", createdAt: "2026-08-01T00:00:00Z" },
          { id: "other", sourceTemplateId: "t2", createdAt: "2026-08-01T00:00:00Z" },
        ],
        "t1",
      ),
      "first",
    );
  });

  it("wires offer upsert / ensure / inherit / prepare-release / portal select without preference→operational coupling", () => {
    const ensure = readFileSync(join(process.cwd(), "lib/floor-plans/ensure-working-layout.ts"), "utf8");
    const offers = readFileSync(join(process.cwd(), "lib/floor-plan-offers/service.ts"), "utf8");
    const inherit = readFileSync(join(process.cwd(), "lib/event-setup/inherit.ts"), "utf8");
    const prepare = readFileSync(join(process.cwd(), "lib/event-setup/prepare-release.ts"), "utf8");
    const actions = readFileSync(join(process.cwd(), "app/(app)/events/[id]/floor-plan-actions.ts"), "utf8");
    const workspace = readFileSync(join(process.cwd(), "components/events/floor-plan-workspace.tsx"), "utf8");
    const phase2Migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20261424600000_floor_plans_phase2_preference_decouple.sql"),
      "utf8",
    );

    assert.match(ensure, /ensureWorkingLayoutForEvent/);
    assert.match(offers, /ensureWorkingLayoutForEvent/);
    assert.match(inherit, /ensureWorkingLayoutForEvent/);
    assert.match(prepare, /ensureWorkingLayoutForEvent/);
    assert.match(actions, /ensureWorkingFloorPlanAction/);
    assert.match(workspace, /ensureWorkingFloorPlanAction/);
    assert.doesNotMatch(workspace, /Offer layouts to couple/);
    assert.match(phase2Migration, /couple_preference_status = 'pending'/);
    assert.doesNotMatch(ensure, /couple_selected_floor_plan_id:\s*floorPlanId/);
  });
});
