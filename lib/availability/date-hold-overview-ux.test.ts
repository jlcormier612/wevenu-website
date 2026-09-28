/**
 * Date Hold UX: Place Hold lives on lead Overview next to preferred date,
 * not under Tasks. Hold date defaults from leads.event_date (no year drift).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { defaultHoldDateFromDesiredEventDate } from "@/lib/availability/hold-defaults";
import { formatDate } from "@/lib/availability/constants";

const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const holdSection = readFileSync(
  resolve("components/availability/date-holds-section.tsx"),
  "utf8",
);
const createHoldAction = readFileSync(
  resolve("app/(app)/availability/actions.ts"),
  "utf8",
);
const createHoldService = readFileSync(
  resolve("lib/availability/service.ts"),
  "utf8",
);
const createHoldRepo = readFileSync(
  resolve("lib/availability/repository.ts"),
  "utf8",
);

describe("Date Hold overview UX placement", () => {
  it("DateHoldsSection is on Overview with desiredEventDate from lead.eventDate", () => {
    assert.match(leadDetail, /desiredEventDate=\{lead\.eventDate\}/);
    assert.match(leadDetail, /Date hold/);
    // Primary create surface is Overview TabsContent, not Tasks TabsContent
    const overviewContent = leadDetail.indexOf('<TabsContent value="overview">');
    const tasksContent = leadDetail.indexOf('<TabsContent value="tasks">');
    const holdsOnOverview = leadDetail.indexOf("<DateHoldsSection", overviewContent);
    assert.ok(overviewContent >= 0 && tasksContent > overviewContent);
    assert.ok(holdsOnOverview > overviewContent && holdsOnOverview < tasksContent);
    assert.equal(leadDetail.indexOf("<DateHoldsSection", tasksContent), -1);
  });

  it("Tasks tab points venues to Overview for date holds", () => {
    assert.match(leadDetail, /To reserve a date, use Date hold on Overview/);
  });

  it("Hold form wires desiredEventDate into defaultHoldDateFromDesiredEventDate", () => {
    assert.match(holdSection, /desiredEventDate/);
    assert.match(holdSection, /defaultHoldDateFromDesiredEventDate/);
    assert.match(holdSection, /Place hold on \$\{formatDate\(desiredDefault\)\}/);
  });

  it("createHoldAction still persists hold_date via date_holds (source of truth)", () => {
    assert.match(createHoldAction, /createHoldAction/);
    assert.match(createHoldAction, /createHold\(/);
    assert.match(createHoldService, /export async function createHold/);
    assert.match(createHoldRepo, /hold_date: input\.holdDate/);
  });
});

describe("Screenshot defect: desired 2027-02-14 must not become 2026-02-14", () => {
  it("default hold date equals desired event date YYYY-MM-DD", () => {
    assert.equal(defaultHoldDateFromDesiredEventDate("2027-02-14"), "2027-02-14");
  });

  it("year boundaries and month boundaries preserve the calendar day", () => {
    assert.equal(defaultHoldDateFromDesiredEventDate("2026-12-31"), "2026-12-31");
    assert.equal(defaultHoldDateFromDesiredEventDate("2027-01-01"), "2027-01-01");
    assert.equal(defaultHoldDateFromDesiredEventDate("2028-02-29"), "2028-02-29");
  });

  it("CTA labels the preferred date when present", () => {
    // formatDate uses en-US short month ("Feb 14, 2027") — CTA uses the same helper
    assert.equal(formatDate("2027-02-14"), "Feb 14, 2027");
    assert.match(holdSection, /Place hold on \$\{formatDate\(desiredDefault\)\}/);
  });
});
