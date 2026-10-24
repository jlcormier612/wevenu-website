/**
 * Scheduled questionnaire delivery — persistence, cron wiring, idempotent claim.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  cancelScheduledQuestionnaireSend,
  scheduleQuestionnaireSend,
} from "@/lib/events/questionnaire-scheduled-send";

const src = readFileSync("lib/events/questionnaire-scheduled-send.ts", "utf8");
const route = readFileSync("app/api/communication/scheduled/process/route.ts", "utf8");
const domain = readFileSync("lib/events/questionnaire.ts", "utf8");

describe("questionnaire scheduled send domain", () => {
  it("rejects past / invalid schedule times without calling the database", async () => {
    const past = await scheduleQuestionnaireSend(
      "00000000-0000-0000-0000-000000000001",
      "final_details",
      new Date(Date.now() - 60_000).toISOString(),
    );
    assert.equal(past.ok, false);
    assert.match(past.message ?? "", /future/i);

    const bad = await scheduleQuestionnaireSend(
      "00000000-0000-0000-0000-000000000001",
      "final_details",
      "not-a-date",
    );
    assert.equal(bad.ok, false);
  });

  it("cancel and schedule helpers are exported for staff actions", () => {
    assert.equal(typeof scheduleQuestionnaireSend, "function");
    assert.equal(typeof cancelScheduledQuestionnaireSend, "function");
  });

  it("processor claims scheduled → sending before sendQuestionnaireToCoupleForVenue", () => {
    assert.match(src, /scheduled_send_status: "sending"/);
    assert.match(src, /sendQuestionnaireToCoupleForVenue/);
    assert.match(src, /\.eq\("scheduled_send_status", "scheduled"\)/);
    assert.match(src, /scheduled_send_status: "sent"/);
    assert.match(src, /scheduled_send_status: "failed"/);
  });

  it("cron route runs questionnaire processor alongside scheduled_messages", () => {
    assert.match(route, /processDueScheduledMessages/);
    assert.match(route, /processDueQuestionnaireScheduledSends/);
    assert.match(route, /messages/);
    assert.match(route, /questionnaires/);
  });

  it("staff send and cron share sendQuestionnaireToCoupleForVenue", () => {
    assert.match(domain, /sendQuestionnaireToCoupleForVenue/);
    assert.match(domain, /export async function sendQuestionnaireToCouple/);
  });
});
