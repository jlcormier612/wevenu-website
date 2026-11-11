import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { configuredPaymentTermsSummary } from "@/lib/contracts/configured-payment-terms";
import {
  contractReviewSourceNote,
  MISSING_PAYMENT_SCHEDULE,
} from "@/lib/contracts/merge-extras";
import { CEREMONY_SPACE_UNLISTED } from "@/lib/contracts/ceremony-reception-merge";

const fmt = (n: number) => `$${n.toFixed(2)}`;

describe("contract payment terms before a schedule exists", () => {
  it("states the Settings four-payment plan against the contracted total", () => {
    const text = configuredPaymentTermsSummary({
      prefs: { remainingBalanceMode: "plan", defaultSchedulePresetId: "wedding_four", defaultCustomSchedule: null },
      contractedTotal: 15000,
      depositAmount: 3750,
      formatAmount: fmt,
    });
    assert.ok(text, "plan terms");
    const lines = text!.split("\n");
    assert.equal(lines.length, 4);
    assert.match(lines[0]!, /\$3750\.00 — due at signing$/);
    const sum = lines.reduce((s, l) => s + Number(l.match(/\$([\d.]+)/)![1]), 0);
    assert.equal(sum, 15000);
    assert.doesNotMatch(text!, /Due today/);
  });

  it("states deposit + remaining balance when Settings collect the balance at the end", () => {
    const text = configuredPaymentTermsSummary({
      prefs: { remainingBalanceMode: "final", defaultSchedulePresetId: null, defaultCustomSchedule: null },
      contractedTotal: 15000,
      depositAmount: 3750,
      formatAmount: fmt,
    });
    assert.equal(
      text,
      "• Deposit: $3750.00 — due at signing\n• Remaining balance: $11250.00 — due on the event day",
    );
  });

  it("returns nothing without a contracted total", () => {
    assert.equal(
      configuredPaymentTermsSummary({
        prefs: { remainingBalanceMode: "final", defaultSchedulePresetId: null, defaultCustomSchedule: null },
        contractedTotal: 0,
        depositAmount: 0,
        formatAmount: fmt,
      }),
      null,
    );
  });

  it("buildContractMergeData falls back to Settings only when no schedule is on file", () => {
    const service = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
    assert.match(
      service,
      /if \(paymentScheduleSummary === MISSING_PAYMENT_SCHEDULE && venue && contractedTotalAmount != null\)/,
    );
  });
});

describe("contract Review source note", () => {
  const spaces = { spaces: [CEREMONY_SPACE_UNLISTED] };

  it("points blank spaces to the lead card and blank payment terms to proposal + Settings", () => {
    const note = contractReviewSourceNote(`${CEREMONY_SPACE_UNLISTED}\n${MISSING_PAYMENT_SCHEDULE}`, spaces);
    assert.match(note ?? "", /Spaces on the lead card/);
    assert.match(note ?? "", /initial proposal and your payment plan in Settings/);
    assert.doesNotMatch(note ?? "", /book|Booked|Set up payments/i);
  });

  it("stays quiet when the agreement is complete", () => {
    assert.equal(contractReviewSourceNote("Ceremony: Barn\n• Deposit: $1 — due at signing", spaces), null);
  });

  it("renders in the Review footer", () => {
    const builder = readFileSync(resolve("components/contracts/contract-builder.tsx"), "utf8");
    assert.match(builder, /data-testid="contract-review-source-note"/);
  });
});
