import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { workspaceDateKind, workspaceDateText, type WorkspaceDateHold } from "@/lib/availability/workspace-date-language";

const NOW = Date.parse("2026-10-16T16:00:00Z");
const DATE = "2027-12-18";

function hold(over: Partial<WorkspaceDateHold> = {}): WorkspaceDateHold {
  return {
    leadId: "lead-1",
    holdDate: DATE,
    endDate: DATE,
    status: "active",
    expiresAt: "2027-01-01T00:00:00Z",
    ...over,
  };
}

describe("workspace date language", () => {
  it("preferred date with no hold", () => {
    const opts = { eventDate: DATE, booked: false, holds: [], leadId: "lead-1", nowMs: NOW };
    assert.equal(workspaceDateKind(opts), "preferred");
    assert.match(workspaceDateText(opts), /^Preferred date: Dec 18, 2027\. This is a preference, not a reservation\.$/);
  });

  it("active hold on the displayed date", () => {
    const opts = { eventDate: DATE, booked: false, holds: [hold()], leadId: "lead-1", nowMs: NOW };
    assert.equal(workspaceDateKind(opts), "held");
    assert.match(
      workspaceDateText(opts),
      /^Date protected — hold active: Dec 18, 2027\. This date is reserved but not yet booked\.$/,
    );
  });

  it("hold on a different date stays a preference", () => {
    const opts = {
      eventDate: DATE,
      booked: false,
      holds: [hold({ holdDate: "2027-12-19", endDate: "2027-12-19" })],
      leadId: "lead-1",
      nowMs: NOW,
    };
    assert.equal(workspaceDateKind(opts), "preferred");
  });

  it("released or expired holds do not count as held", () => {
    for (const row of [
      hold({ status: "released" }),
      hold({ status: "expired" }),
      hold({ status: "converted" }),
      hold({ status: "active", expiresAt: "2026-10-01T00:00:00Z" }),
    ]) {
      assert.equal(workspaceDateKind({ eventDate: DATE, booked: false, holds: [row], leadId: "lead-1", nowMs: NOW }), "preferred");
    }
  });

  it("a date-range hold covers an included day and not the day after", () => {
    const range = hold({ holdDate: "2027-12-17", endDate: "2027-12-19" });
    assert.equal(workspaceDateKind({ eventDate: DATE, booked: false, holds: [range], leadId: "lead-1", nowMs: NOW }), "held");
    assert.equal(workspaceDateKind({ eventDate: "2027-12-20", booked: false, holds: [range], leadId: "lead-1", nowMs: NOW }), "preferred");
  });

  it("a booked event is not described as preferred or held", () => {
    const text = workspaceDateText({ eventDate: DATE, booked: true, holds: [hold()], leadId: "lead-1", nowMs: NOW });
    assert.equal(text, "Event date: Dec 18, 2027.");
    assert.doesNotMatch(text, /Preferred|held/i);
  });

  it("preferred date can differ from a hold on another day", () => {
    const text = workspaceDateText({
      eventDate: DATE,
      booked: false,
      holds: [hold({ holdDate: "2028-01-02", endDate: "2028-01-02" })],
      leadId: "lead-1",
      nowMs: NOW,
    });
    assert.match(text, /Preferred date: Dec 18, 2027/);
    assert.doesNotMatch(text, /Date protected|Date held/);
  });

  it("another lead's hold does not change this date", () => {
    assert.equal(
      workspaceDateKind({ eventDate: DATE, booked: false, holds: [hold({ leadId: "other" })], leadId: "lead-1", nowMs: NOW }),
      "preferred",
    );
  });

  it("lead and client workspace share the helper", () => {
    const lead = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    const client = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
    assert.match(lead, /workspaceDateText/);
    assert.match(client, /workspaceDateText/);
    assert.doesNotMatch(client, /Preferred date: \$\{client\.eventDate\}/);
  });
});
