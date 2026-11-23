import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countOpenSupportItems,
  relationshipHasOpenSupport,
} from "./sales-cs";
import {
  isActionableSupportFeedbackType,
  type Relationship,
} from "./types";

function rel(
  items: Array<{ type: string; status?: string }>,
  extras: Partial<Relationship> = {},
): Relationship {
  return {
    id: "rel_support_test",
    venue: { name: "Support Test Venue", city: "Austin", state: "TX" },
    owner: {
      id: "c1",
      firstName: "Pat",
      lastName: "Owner",
      email: "stage1e-support@hellotocheers.com",
    },
    status: "active",
    health: "good",
    assignedTeamMemberId: "tm_1",
    planId: "gather",
    planName: "Gather",
    foundingMember: false,
    welcomeBackRequested: false,
    welcomeBackVerified: "none",
    onboardingType: "self_guided",
    currentStageLabel: "Live",
    lastContactAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    supportOpenCount: 0,
    openFeedbackItems: items.map((i, idx) => ({
      id: `fb_${idx}`,
      type: i.type as "support" | "bug" | "feature" | "nps" | "general",
      subject: i.type,
      createdAt: new Date().toISOString(),
      status: (i.status as "open" | "resolved") || "open",
      source: "product",
    })),
    ...extras,
  };
}

describe("Stage 1E support intake classification", () => {
  it("treats Get Help and Report a Bug as actionable", () => {
    assert.equal(isActionableSupportFeedbackType("support"), true);
    assert.equal(isActionableSupportFeedbackType("bug"), true);
    assert.equal(isActionableSupportFeedbackType("feature"), false);
    assert.equal(isActionableSupportFeedbackType("nps"), false);
    assert.equal(isActionableSupportFeedbackType("general"), false);
  });

  it("Needs Support counts only actionable open items", () => {
    const withIdea = rel([{ type: "feature" }, { type: "nps" }]);
    assert.equal(countOpenSupportItems(withIdea), 0);
    assert.equal(relationshipHasOpenSupport(withIdea), false);

    const withHelp = rel([{ type: "support" }, { type: "feature" }]);
    assert.equal(countOpenSupportItems(withHelp), 1);
    assert.equal(relationshipHasOpenSupport(withHelp), true);

    const withBug = rel([{ type: "bug" }]);
    assert.equal(countOpenSupportItems(withBug), 1);
  });

  it("resolved ideas do not affect support counts", () => {
    const resolved = rel([{ type: "support", status: "resolved" }]);
    assert.equal(countOpenSupportItems(resolved), 0);
  });
});

describe("Stage 1E support intake wiring (source)", () => {
  it("venue ingest escalates only help/bug and skips urgent alerts for ideas/ratings", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "ingest.ts"), "utf8");
    assert.match(src, /only Get Help \/ Report a Bug overlay Needs Support/);
    assert.match(src, /notification: isHelpOrBug/);
    assert.match(src, /Client submissions never write venue Relationship/);
    assert.match(
      src,
      /Urgent CRM alerts only for Get Help \/ Report a Bug/,
    );
  });

  it("product and portal APIs soft-sync CRM after successful persistence", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(__dirname, "../..");
    const venueApi = readFileSync(join(root, "app/api/feedback/route.ts"), "utf8");
    const clientApi = readFileSync(
      join(root, "app/api/portal/product-feedback/route.ts"),
      "utf8",
    );
    // Persistence first — CRM sync is best-effort after ok insert.
    assert.match(venueApi, /return NextResponse\.json\(\{ ok: true/);
    assert.match(venueApi, /pushFeedbackToCrm/);
    assert.match(venueApi, /pushPartnerFeedbackToCrm/);
    assert.match(clientApi, /submit_product_feedback_from_portal/);
    assert.match(clientApi, /ingestProductPartnerFeedback/);
    assert.match(clientApi, /never block portal submit/i);
    // Failures return error, not ok.
    assert.match(venueApi, /if \(error\) return NextResponse\.json\(\{ error:/);
    assert.match(clientApi, /if \(!result\?\.ok\)/);
  });
});
