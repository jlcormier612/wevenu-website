import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseMessageTemplateSource,
  parsePlanningChecklist,
  timingFromLine,
} from "@/lib/onboarding/white-glove-content-import";

describe("white glove message template import", () => {
  it("maps JSON templates and reports unsupported fields", () => {
    const parsed = parseMessageTemplateSource(JSON.stringify([
      {
        name: "Inquiry reply",
        category: "inquiry_follow_up",
        emailSubject: "Thanks",
        emailBody: "Hello {{client_name}}",
        smsBody: "",
        mailchimpId: "abc",
      },
    ]));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.proposals.length, 1);
    assert.equal(parsed.proposals[0].name, "Inquiry reply");
    assert.equal(parsed.proposals[0].category, "inquiry_follow_up");
    assert.equal(parsed.proposals[0].emailBody, "Hello {{client_name}}");
    assert.deepEqual(parsed.proposals[0].unsupported, ["mailchimpId"]);
    assert.match(parsed.proposals[0].warnings.join(" "), /mailchimpId/);
  });

  it("rejects malformed JSON instead of inventing a template", () => {
    const parsed = parseMessageTemplateSource("[{name:");
    assert.equal(parsed.ok, false);
  });

  it("does not treat an unknown category as a supported one", () => {
    const parsed = parseMessageTemplateSource([
      "---",
      "Name: Legacy blast",
      "Category: drip_campaign",
      "Subject: Hi",
      "Body:",
      "See you soon",
    ].join("\n"));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.proposals[0].category, "general");
    assert.match(parsed.proposals[0].warnings.join(" "), /drip_campaign/);
  });
});

describe("white glove planning import", () => {
  it("keeps explicit timing and leaves unstated timing empty", () => {
    assert.deepEqual(timingFromLine("Book florist 2 weeks before"), { daysOffset: -14, timingKnown: true });
    assert.deepEqual(timingFromLine("Send thank you 3 days after"), { daysOffset: 3, timingKnown: true });
    assert.equal(timingFromLine("Confirm menu").timingKnown, false);
    const parsed = parsePlanningChecklist([
      "# Catering",
      "- Book florist 2 weeks before",
      "- Confirm menu",
    ].join("\n"));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.tasks[0].milestone, "Catering");
    assert.equal(parsed.tasks[0].daysOffset, -14);
    assert.equal(parsed.tasks[1].timingKnown, false);
    assert.equal(parsed.tasks[1].daysOffset, null);
    assert.match(parsed.notes.join(" "), /will not be invented/);
  });

  it("does not claim success for an empty document", () => {
    const parsed = parsePlanningChecklist("   \n");
    assert.equal(parsed.ok, false);
  });
});
