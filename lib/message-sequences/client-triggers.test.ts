/**
 * Client Automation triggers — mapping, audience, and product boundaries.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { SEQUENCE_TRIGGER_TYPES } from "@/lib/message-sequences/constants";
import {
  audienceForTrigger,
  CLIENT_SEQUENCE_TRIGGERS,
  PLATFORM_EVENT_TO_SEQUENCE_TRIGGER,
  SALES_SEQUENCE_TRIGGERS,
  sequenceTriggerForPlatformEvent,
} from "@/lib/message-sequences/platform-triggers";
import { STARTER_SEQUENCE_MASTERS } from "@/lib/message-sequences/starters";

describe("Automation platform-event triggers", () => {
  it("maps every supported client Platform Event to a sequence trigger", () => {
    assert.equal(sequenceTriggerForPlatformEvent("Contract.Signed"), "contract_signed");
    assert.equal(sequenceTriggerForPlatformEvent("Payment.Received"), "payment_received");
    assert.equal(sequenceTriggerForPlatformEvent("Questionnaire.Submitted"), "questionnaire_submitted");
    assert.equal(sequenceTriggerForPlatformEvent("GuestCount.Submitted"), "guest_count_submitted");
    assert.equal(sequenceTriggerForPlatformEvent("Event.Completed"), "event_completed");
    assert.equal(sequenceTriggerForPlatformEvent("Booking.Confirmed"), null);
  });

  it("exposes Sales and Client triggers in the venue picker", () => {
    const values = SEQUENCE_TRIGGER_TYPES.map((t) => t.value);
    for (const t of SALES_SEQUENCE_TRIGGERS) assert.ok(values.includes(t));
    for (const t of CLIENT_SEQUENCE_TRIGGERS) assert.ok(values.includes(t));
    assert.equal(SEQUENCE_TRIGGER_TYPES.filter((t) => t.audience === "sales").length, 3);
    assert.equal(SEQUENCE_TRIGGER_TYPES.filter((t) => t.audience === "client").length, 5);
  });

  it("does not offer anniversary as a trigger (no trustworthy domain event)", () => {
    assert.ok(!SEQUENCE_TRIGGER_TYPES.some((t) => /anniversary/i.test(t.value) || /anniversary/i.test(t.label)));
    assert.ok(!Object.keys(PLATFORM_EVENT_TO_SEQUENCE_TRIGGER).some((k) => /Anniversary/i.test(k)));
  });

  it("classifies audience correctly", () => {
    assert.equal(audienceForTrigger("lead_created"), "sales");
    assert.equal(audienceForTrigger("event_completed"), "client");
    assert.equal(audienceForTrigger(null), "manual");
  });

  it("ships SEQ-04 Post-Event Thank You on event_completed with MSG-11", () => {
    const seq04 = STARTER_SEQUENCE_MASTERS.find((m) => m.key === "SEQ-04");
    assert.ok(seq04);
    assert.equal(seq04.triggerType, "event_completed");
    assert.equal(seq04.initialStatus, "paused");
    assert.equal(seq04.steps[0]?.templateMasterKey, "MSG-11");
  });

  it("does not invent starters for triggers without message templates", () => {
    const starterTriggers = new Set(STARTER_SEQUENCE_MASTERS.map((m) => m.triggerType));
    assert.ok(!starterTriggers.has("contract_signed"));
    assert.ok(!starterTriggers.has("payment_received"));
    assert.ok(!starterTriggers.has("questionnaire_submitted"));
    assert.ok(!starterTriggers.has("guest_count_submitted"));
  });
});

describe("Automation product boundaries in source", () => {
  it("does not turn Automations into task orchestration", () => {
    const actions = readFileSync(join(process.cwd(), "lib/automation/actions.ts"), "utf8");
    assert.doesNotMatch(actions, /createEventTask|insertEventTask|unlockTask/);
    const processEnroll = readFileSync(
      join(process.cwd(), "lib/message-sequences/process-platform-enrollments.ts"),
      "utf8",
    );
    assert.doesNotMatch(processEnroll, /event_tasks|playbook_tasks/);
  });

  it("keeps customer-facing Automations copy free of Series/Sequence jargon on list/help", () => {
    const list = readFileSync(join(process.cwd(), "components/communication/series-list.tsx"), "utf8");
    const help = readFileSync(join(process.cwd(), "components/communication/automations-help.tsx"), "utf8");
    const page = readFileSync(join(process.cwd(), "app/(app)/communication/series/page.tsx"), "utf8");
    for (const src of [list, help, page]) {
      assert.doesNotMatch(src, />\s*Series\s*</);
      assert.doesNotMatch(src, /Sequence Builder|Workflow Builder/);
    }
    assert.match(page, /Automations/);
  });

  it("migration expands trigger vocabulary and emits client platform events", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261387000000_automation_client_triggers.sql"),
      "utf8",
    );
    assert.match(sql, /contract_signed/);
    assert.match(sql, /payment_received/);
    assert.match(sql, /questionnaire_submitted/);
    assert.match(sql, /guest_count_submitted/);
    assert.match(sql, /event_completed/);
    assert.match(sql, /Contract\.Signed/);
    assert.match(sql, /Questionnaire\.Submitted/);
    assert.match(sql, /GuestCount\.Submitted/);
    assert.match(sql, /sequence_platform_event_claims/);
    assert.match(sql, /platform_event_automation_scans/);
  });
});
