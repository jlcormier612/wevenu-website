import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isSameRecordDraftRecommendation } from "@/lib/luv/same-record-draft-cta";

describe("isSameRecordDraftRecommendation", () => {
  const draftObs = {
    recommendation: {
      label: "Ask Luv to draft a follow-up",
      link: "/leads/L1?luv=follow_up_email",
      type: "draft" as const,
    },
    link: "/leads/L1?luv=follow_up_email",
  };

  it("detects same-record draft CTAs that soft-nav would no-op", () => {
    assert.equal(isSameRecordDraftRecommendation(draftObs, "/leads/L1"), true);
    assert.equal(isSameRecordDraftRecommendation(draftObs, "/leads/L1?tab=overview"), true);
  });

  it("ignores cross-record or non-draft recommendations", () => {
    assert.equal(isSameRecordDraftRecommendation(draftObs, "/leads/OTHER"), false);
    assert.equal(isSameRecordDraftRecommendation(draftObs, "/dashboard"), false);
    assert.equal(
      isSameRecordDraftRecommendation(
        {
          recommendation: { label: "Open calendar", link: "/leads/L1", type: "navigate" as const },
          link: "/leads/L1",
        },
        "/leads/L1",
      ),
      false,
    );
    assert.equal(isSameRecordDraftRecommendation({ link: "/leads/L1" }, "/leads/L1"), false);
  });
});

describe("Luv noticed same-record draft wiring", () => {
  it("LuvDraftPanel invokes generate instead of soft Link for same-record drafts", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "components/luv/luv-draft-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /onSameRecordDraft=\{\(\) => void handleGenerate\(\)\}/);
    assert.match(panel, /currentPath=\{`\/leads\/\$\{lead\.id\}`\}/);
    assert.match(panel, /externalDraftRequest/);
  });

  it("ContextualLuvObservationsPanel exposes a draft button for same-record CTAs", () => {
    const src = readFileSync(
      resolve(process.cwd(), "components/luv/contextual-observations-panel.tsx"),
      "utf8",
    );
    assert.match(src, /data-testid="luv-noticed-draft-follow-up"/);
    assert.match(src, /isSameRecordDraftRecommendation/);
    assert.match(src, /onSameRecordDraft/);
    assert.match(src, /luv-noticed-draft-ineligible/);
  });

  it("lead detail Overview CTA switches to Luv and requests a draft", () => {
    const detail = readFileSync(
      resolve(process.cwd(), "components/leads/lead-detail.tsx"),
      "utf8",
    );
    assert.match(detail, /setLuvDraftRequest/);
    assert.match(detail, /externalDraftRequest=\{luvDraftRequest\}/);
    assert.match(detail, /if \(autoLuvDraft\) setActiveTab\("luv"\)/);
  });
});
