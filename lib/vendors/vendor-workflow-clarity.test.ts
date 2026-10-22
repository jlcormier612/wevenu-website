import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { overviewVendorSummaryLines } from "@/lib/vendors/overview-vendor-copy";
import { partitionRecommendationsByCoupleSubmission } from "@/lib/vendors/recommendation-submission-groups";

describe("overviewVendorSummaryLines", () => {
  it("labels assignments as assigned, not couple selections", () => {
    const lines = overviewVendorSummaryLines({
      assignmentCount: 2,
      highlightCount: 3,
      submittedHighlightCount: 1,
    });
    assert.match(lines[0]!, /2 vendors assigned to this event/);
    assert.doesNotMatch(lines[0]!, /selected/i);
    assert.match(lines[1]!, /2 highlighted vendors not yet chosen by the couple/);
    assert.doesNotMatch(lines.join(" "), /pending|approv/i);
  });

  it("uses singular grammar", () => {
    const lines = overviewVendorSummaryLines({
      assignmentCount: 1,
      highlightCount: 1,
      submittedHighlightCount: 0,
    });
    assert.equal(lines[0], "1 vendor assigned to this event.");
    assert.equal(lines[1], "1 highlighted vendor not yet chosen by the couple.");
  });

  it("reports no highlights honestly", () => {
    const lines = overviewVendorSummaryLines({
      assignmentCount: 0,
      highlightCount: 0,
      submittedHighlightCount: 0,
    });
    assert.match(lines[0]!, /No vendors assigned/);
    assert.match(lines[1]!, /No vendors highlighted for this event yet/);
  });

  it("reports all highlights submitted honestly", () => {
    const lines = overviewVendorSummaryLines({
      assignmentCount: 3,
      highlightCount: 2,
      submittedHighlightCount: 2,
    });
    assert.match(lines[1]!, /submitted choices for all highlighted vendors/);
  });
});

describe("partitionRecommendationsByCoupleSubmission", () => {
  it("groups by selectedAt only — pickedAt never counts as submitted", () => {
    const rows = [
      { id: "a", selectedAt: "2026-01-01T00:00:00Z", pickedAt: null },
      { id: "b", selectedAt: null, pickedAt: "2026-01-02T00:00:00Z" },
      { id: "c", selectedAt: null, pickedAt: null },
    ];
    const { chosen, notYetSubmitted } = partitionRecommendationsByCoupleSubmission(rows);
    assert.deepEqual(chosen.map((r) => r.id), ["a"]);
    assert.deepEqual(notYetSubmitted.map((r) => r.id), ["b", "c"]);
  });

  it("leaves both groups empty when there are no rows", () => {
    const { chosen, notYetSubmitted } = partitionRecommendationsByCoupleSubmission([]);
    assert.equal(chosen.length, 0);
    assert.equal(notYetSubmitted.length, 0);
  });
});

describe("vendor workflow clarity UI seams", () => {
  const overview = readFileSync(resolve("components/events/booking-overview-summary.tsx"), "utf8");
  const readiness = readFileSync(resolve("lib/event-setup/readiness-detail.ts"), "utf8");
  const setupPanel = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");
  const highlights = readFileSync(
    resolve("components/events/vendors/event-vendor-recommendations-section.tsx"),
    "utf8",
  );
  const preview = readFileSync(resolve("components/events/client-portal-preview.tsx"), "utf8");
  const previewView = readFileSync(resolve("components/portal/vendors-preview-view.tsx"), "utf8");
  const removeAction = readFileSync(resolve("app/(app)/events/[id]/vendor-actions.ts"), "utf8");

  it("Overview uses overviewVendorSummaryLines helper", () => {
    // Live Overview Vendors card = Event Setup vendors row (BookingOverviewSummary is unmounted).
    assert.match(readiness, /overviewVendorSummaryLines/);
    assert.match(setupPanel, /overview-vendors-tile/);
    assert.match(setupPanel, /vendorAssignmentCount/);
    assert.match(overview, /overviewVendorSummaryLines/);
    assert.doesNotMatch(overview, /vendors selected|recommendations pending/i);
    assert.doesNotMatch(readiness, /vendors selected|recommendations pending/i);
  });

  it("highlights section groups by selectedAt and explains remove ≠ unassign", () => {
    assert.match(highlights, /partitionRecommendationsByCoupleSubmission/);
    assert.match(highlights, /vendor-highlights-chosen/);
    assert.match(highlights, /vendor-highlights-not-submitted/);
    assert.match(highlights, /does not unassign/);
    assert.match(highlights, /recommendVendorAction/);
    assert.match(highlights, /unrecommendVendorAction/);
  });

  it("remove recommendation action does not call removeVendorAssignment", () => {
    assert.match(removeAction, /export async function unrecommendVendorAction/);
    const fn = removeAction.slice(
      removeAction.indexOf("export async function unrecommendVendorAction"),
      removeAction.indexOf("export async function ensureEventRecommendationsFromNetworkAction"),
    );
    assert.doesNotMatch(fn, /removeVendorAssignment/);
  });

  it("preview clarifies recommendations are not the assigned roster", () => {
    assert.match(preview, /Recommendations — not the assigned roster/);
    assert.match(previewView, /does not show the assigned roster/);
    assert.doesNotMatch(previewView, /getOrEnsureEventRecommendations/);
  });
});
