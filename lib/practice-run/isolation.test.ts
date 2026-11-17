import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertPracticeSideEffectAllowed,
  isPracticeLinkedId,
  isPracticeSampleEmail,
  practiceSampleEmail,
  practiceSideEffectBlockedMessage,
} from "@/lib/practice-run/isolation";
import { PRACTICE_SIDE_EFFECT_ENTRY_POINTS } from "@/lib/practice-run/side-effect-registry";
import { PRACTICE_CELEBRATION_NAME, PRACTICE_REASSURANCE } from "@/lib/practice-run/types";

describe("practice isolation", () => {
  it("recognizes practice-linked ids and sample emails", () => {
    assert.equal(isPracticeLinkedId(null), false);
    assert.equal(isPracticeLinkedId(""), false);
    assert.equal(isPracticeLinkedId("  "), false);
    assert.equal(isPracticeLinkedId("run-1"), true);
    const email = practiceSampleEmail("a415ac52-cd74-42a6-8df7-7a8f6e71d080");
    assert.match(email, /@practice\.hellotocheers\.invalid$/);
    assert.equal(isPracticeSampleEmail(email), true);
    assert.equal(isPracticeSampleEmail("real@venue.com"), false);
  });

  it("blocks external side effects for practice-linked records", () => {
    assert.doesNotThrow(() =>
      assertPracticeSideEffectAllowed({ practiceRunId: null, kind: "email" }),
    );
    assert.throws(
      () => assertPracticeSideEffectAllowed({ practiceRunId: "run-1", kind: "email" }),
      /do not send messages/i,
    );
    assert.throws(
      () => assertPracticeSideEffectAllowed({ practiceRunId: "run-1", kind: "stripe_charge" }),
      /never create live payment/i,
    );
    assert.match(practiceSideEffectBlockedMessage("client_invitation"), /do not invite/i);
  });

  it("keeps the approved celebration naming and reassurance copy", () => {
    assert.equal(PRACTICE_CELEBRATION_NAME, "Maya & Jordan Practice Wedding");
    assert.match(PRACTICE_REASSURANCE, /Practice Run/);
    assert.match(PRACTICE_REASSURANCE, /nothing here will be sent/i);
  });

  it("registers the future side-effect entry points that later slices must guard", () => {
    const kinds = new Set(PRACTICE_SIDE_EFFECT_ENTRY_POINTS.map((entry) => entry.kind));
    for (const kind of [
      "email",
      "sms",
      "stripe_charge",
      "quickbooks_sync",
      "vendor_notification",
      "client_invitation",
      "automation_dispatch",
      "reminder_dispatch",
      "public_availability_block",
    ]) {
      assert.equal(kinds.has(kind as never), true, `missing ${kind}`);
    }
  });
});
