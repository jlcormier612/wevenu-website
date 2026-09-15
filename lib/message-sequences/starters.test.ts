/**
 * Starter Automations masters + product boundary checks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { STARTER_SEQUENCE_MASTERS } from "@/lib/message-sequences/starters";

describe("starter Automations (launch set)", () => {
  it("includes New Inquiry, Tour Follow-Up, Proposal Follow-Up, and Post-Event Thank You", () => {
    const keys = STARTER_SEQUENCE_MASTERS.map((m) => m.key);
    assert.deepEqual(keys, ["SEQ-01", "SEQ-02", "SEQ-03", "SEQ-04"]);
  });

  it("SEQ-01 is active by default; SEQ-02/03/04 start paused (safe opt-in)", () => {
    const byKey = Object.fromEntries(STARTER_SEQUENCE_MASTERS.map((m) => [m.key, m]));
    assert.equal(byKey["SEQ-01"]!.initialStatus, "active");
    assert.equal(byKey["SEQ-02"]!.initialStatus, "paused");
    assert.equal(byKey["SEQ-03"]!.initialStatus, "paused");
    assert.equal(byKey["SEQ-04"]!.initialStatus, "paused");
  });

  it("Tour Follow-Up uses tour_completed + MSG-04", () => {
    const tour = STARTER_SEQUENCE_MASTERS.find((m) => m.key === "SEQ-02")!;
    assert.equal(tour.triggerType, "tour_completed");
    assert.equal(tour.triggerStage, null);
    assert.equal(tour.steps[0]!.templateMasterKey, "MSG-04");
    assert.equal(tour.steps[0]!.offsetDays, 1);
  });

  it("Proposal Follow-Up uses Proposal Sent stage + MSG-05", () => {
    const proposal = STARTER_SEQUENCE_MASTERS.find((m) => m.key === "SEQ-03")!;
    assert.equal(proposal.triggerType, "lead_stage_changed");
    assert.equal(proposal.triggerStage, "proposal_sent");
    assert.equal(proposal.steps[0]!.templateMasterKey, "MSG-05");
    assert.equal(proposal.steps[0]!.offsetDays, 3);
  });
});

describe("Automations product boundaries (architecture)", () => {
  it("scheduled-message processor gates Automation sends on consent + pause", () => {
    const src = readFileSync(
      path.join(process.cwd(), "lib/scheduled-messages/processor.ts"),
      "utf8",
    );
    assert.match(src, /assertChannelAllowed/);
    assert.match(src, /isEnrollmentSequencePaused/);
  });

  it("payment received auto-completes tasks without message-sequence enrollment at the payment call site", () => {
    const src = readFileSync(path.join(process.cwd(), "lib/payments/service.ts"), "utf8");
    assert.match(src, /triggerAutoComplete/);
    assert.match(src, /Payment\.Received/);
    assert.doesNotMatch(src, /triggerSequencesForRelationship/);
  });

  it("playbook auto-complete is separate from Automations enrollment", () => {
    const src = readFileSync(path.join(process.cwd(), "lib/playbooks/service.ts"), "utf8");
    assert.match(src, /export async function triggerAutoComplete/);
    assert.doesNotMatch(src, /triggerSequencesForRelationship/);
  });

  it("post-event thank you is SEQ-04 under Automations; Settings only toggles it", () => {
    const seq04 = STARTER_SEQUENCE_MASTERS.find((m) => m.key === "SEQ-04");
    assert.ok(seq04);
    assert.equal(seq04.triggerType, "event_completed");
    const settings = readFileSync(
      path.join(process.cwd(), "components/settings/review-referral-nudge-section.tsx"),
      "utf8",
    );
    assert.match(settings, /Post-event thank you|Automations/);
    assert.match(settings, /\/communication\/series/);
  });
});
