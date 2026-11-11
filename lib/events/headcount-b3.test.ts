/**
 * Narrow B / B3 — shared-but-unapproved headcount change → stale / Send updated copy.
 *
 * Run: npx tsx --test lib/events/headcount-b3.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { shouldRecalcBoundLines } from "@/lib/events/headcount-recalc";
import { describeEventOrderJourney } from "@/lib/event-orders/event-order-journey";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("B3 gate helpers", () => {
  it("allows shared-but-unapproved (open or finalized); blocks approved", () => {
    assert.equal(
      shouldRecalcBoundLines({ status: "open", sharedAt: "2026-01-01T00:00:00Z", clientAgreedAt: null }),
      null,
    );
    assert.equal(
      shouldRecalcBoundLines({ status: "finalized", sharedAt: "2026-01-01T00:00:00Z", clientAgreedAt: null }),
      null,
    );
    assert.equal(
      shouldRecalcBoundLines({
        status: "finalized",
        sharedAt: "2026-01-01T00:00:00Z",
        clientAgreedAt: "2026-01-02T00:00:00Z",
      }),
      "approved",
    );
    assert.equal(
      shouldRecalcBoundLines({ status: "finalized", sharedAt: null, clientAgreedAt: null }),
      "not_open",
    );
  });
});

describe("B3 journey + wiring", () => {
  it("stale shared finalized journey still offers Send updated copy", () => {
    const { current, rows } = describeEventOrderJourney({
      choices: [],
      eventOrder: {
        status: "finalized",
        sharedAt: "2026-06-01T00:00:00Z",
        clientAgreedAt: null,
        revision: 2,
      },
      hasEoInvoice: false,
      shareCommitmentStale: true,
    });
    assert.equal(current.primaryLabel, "Send updated copy");
    assert.equal(current.action, "resend");
    assert.equal(rows.find((r) => r.key === "approval")?.state, "Approval needed again");
  });

  it("recalc reopens finalized shared-unapproved and mentions Send updated copy", () => {
    const recalc = read("lib/events/headcount-recalc.ts");
    assert.match(recalc, /reopenEventOrder/);
    assert.match(recalc, /Send updated copy/);
    assert.match(recalc, /Live lines now differ from the couple's shared copy/);
    assert.doesNotMatch(recalc, /return "shared"/);
  });
});
