import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  EVENT_ORDER_SHARE_REQUIRES_FINALIZED_MESSAGE,
  shareBlockedWhenNotFinalized,
} from "@/lib/event-orders/lifecycle-gates";

const ROOT = join(__dirname, "../..");

describe("Event Order client visibility — share gate + portal contract", () => {
  it("refuses share until finalized (Bindi-style open order cannot silently appear for client)", () => {
    const blocked = shareBlockedWhenNotFinalized("open");
    assert.ok(blocked && blocked.ok === false);
    assert.equal(blocked.message, EVENT_ORDER_SHARE_REQUIRES_FINALIZED_MESSAGE);
    assert.equal(shareBlockedWhenNotFinalized("finalized"), null);
  });

  it("portal RPC requires shared_at and prefers share snapshots", () => {
    const mig = readFileSync(
      join(ROOT, "supabase/migrations/20261361000000_offerings_and_event_order_model.sql"),
      "utf8",
    );
    assert.match(mig, /get_event_order_for_portal/);
    assert.match(mig, /eo\.shared_at is not null/);
    assert.match(mig, /event_order_share_snapshots/);
    assert.match(mig, /e\.client_id = v_session\.client_id/);
  });

  it("venue Share path inserts snapshot then sets shared_at", () => {
    const representation = readFileSync(join(ROOT, "lib/event-orders/representation.ts"), "utf8");
    assert.match(representation, /insertShareSnapshot/);
    assert.match(representation, /setSharedAt/);
    assert.match(representation, /shareBlockedWhenNotFinalized/);
  });

  it("client empty state copy remains for unshared orders", () => {
    const view = readFileSync(join(ROOT, "components/portal/event-order-view.tsx"), "utf8");
    assert.match(view, /Not shared yet/);
    assert.match(view, /Your venue has not shared an Event Order/);
  });
});
