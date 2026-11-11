/**
 * Locked Automations builder copy + Inbox Needs response pink treatment.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("Automations builder locked UX", () => {
  const form = readFileSync(
    join(process.cwd(), "components/communication/series-form.tsx"),
    "utf8",
  );

  it("uses the exact What happens timing explanation", () => {
    assert.match(
      form,
      /Messages send in the order you set them\. A message set to 0 days sends immediately\. Messages scheduled for a later day go out at 10:00 AM in your venue.s local time\./,
    );
  });

  it("uses the exact sales-stage option wording without hard-coded In Follow-Up", () => {
    assert.match(
      form,
      /Also move their sales stage forward when they enter this automation/,
    );
    assert.doesNotMatch(form, /In Follow-Up/);
    assert.doesNotMatch(form, /enrolled_in_sequence/);
  });

  it("does not use joined terminology for enrollment", () => {
    assert.doesNotMatch(form, /\bjoin(ed|ing)?\b/i);
    assert.match(form, /enter this automation/);
  });

  it("shows inline template preview via existing merge renderer and Edit message link", () => {
    assert.match(form, /substituteSampleMergeFields/);
    assert.match(form, /Edit message/);
    assert.match(form, /\/communication\/templates\/\$\{selected\.id\}\/edit/);
    assert.doesNotMatch(form, /automation_message_body|automation_sms_body/);
  });

  it("shows human-readable timing labels", () => {
    assert.match(form, /automationStepTimingLabel/);
  });
});

describe("Inbox Needs response visual", () => {
  it("uses HTC destructive pink token, not warning gray", () => {
    const inbox = readFileSync(
      join(process.cwd(), "app/(app)/messaging/conversation-inbox.tsx"),
      "utf8",
    );
    assert.match(inbox, /Needs response/);
    assert.match(inbox, /bg-destructive/);
    assert.match(inbox, /text-destructive-foreground/);
    assert.doesNotMatch(
      inbox.slice(inbox.indexOf("needsResponse"), inbox.indexOf("needsResponse") + 400),
      /bg-warning/,
    );
  });
});
