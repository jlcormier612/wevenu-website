import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { LEAD_BOOKED_STATUS_HOLD, parseImportedLeadSalesStage } from "./lead-import";

const csvImport = readFileSync(resolve("app/(app)/settings/import/actions.ts"), "utf8");
const csvLeads = csvImport.slice(
  csvImport.indexOf("export async function importLeadsAction"),
  csvImport.indexOf("export async function importVendorsAction"),
);

describe("parseImportedLeadSalesStage", () => {
  it("maps follow-up language onto an assignable pipeline stage", () => {
    const parsed = parseImportedLeadSalesStage("In follow-up");
    assert.deepEqual(parsed, { kind: "stage", stage: "enrolled_in_sequence" });
  });

  it("refuses booked as a Lead status", () => {
    assert.deepEqual(parseImportedLeadSalesStage("booked"), { kind: "booked" });
    assert.match(LEAD_BOOKED_STATUS_HOLD, /Clients and their events/i);
  });

  it("does not invent a stage from unknown text", () => {
    assert.deepEqual(parseImportedLeadSalesStage("warm"), { kind: "unknown", raw: "warm" });
  });
});

describe("self-service Lead import extra inquiries", () => {
  it("holds same-person rows for a venue decision instead of auto-creating or auto-skipping", () => {
    assert.match(csvLeads, /classifyVenueControlledMatch/);
    assert.match(csvLeads, /resolveImportMatchAction/);
    assert.match(csvLeads, /Held for your decision|venueMatchSkipMessage/);
    assert.doesNotMatch(csvLeads, /leadInquiryRetryKey/);
    assert.doesNotMatch(csvLeads, /merge_leads_v1|confirmMergeLeads/);
  });
});
