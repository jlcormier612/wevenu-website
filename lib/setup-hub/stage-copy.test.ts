import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSetupGuide } from "@/lib/help-guides/setup-guides";

import { STAGE_COPY } from "./stage-copy";

describe("Setup Hub stage copy", () => {
  it("covers every canonical Setup Hub stage", () => {
    assert.deepEqual(Object.keys(STAGE_COPY), [
      "your-venue",
      "calendar-availability",
      "bring-your-business",
      "your-offerings",
      "client-experience",
      "lead-capture",
      "your-team",
      "financials",
    ]);
  });

  // Every stage now points at its own prescriptive guide rather than at whichever
  // general Help article happened to exist, so a stage can no longer send an owner
  // somewhere that does not answer the question the stage just asked.
  it("gives every stage a help link that resolves to a real setup guide", () => {
    for (const [stage, copy] of Object.entries(STAGE_COPY)) {
      assert.ok(copy.helpHref, `${stage} must link to a setup guide`);
      assert.ok(copy.helpTitle, `${stage} must label its guide link`);

      const slug = copy.helpHref!.replace(/^\/help\//, "");
      assert.notEqual(slug, copy.helpHref, `${stage} helpHref must be a /help/ route`);
      assert.ok(
        getSetupGuide(slug),
        `${stage} links to /help/${slug}, which is not a guide in SETUP_GUIDES`,
      );
    }
  });

  it("points each stage at the guide for that stage's own subject", () => {
    assert.equal(STAGE_COPY["your-venue"].helpHref, "/help/setup-your-venue");
    assert.equal(STAGE_COPY["calendar-availability"].helpHref, "/help/setup-calendar-availability");
    assert.equal(STAGE_COPY["bring-your-business"].helpHref, "/help/setup-bring-your-business");
    assert.equal(STAGE_COPY["your-offerings"].helpHref, "/help/setup-your-offerings");
    assert.equal(STAGE_COPY["client-experience"].helpHref, "/help/setup-client-experience");
    assert.equal(STAGE_COPY["lead-capture"].helpHref, "/help/setup-lead-capture");
    assert.equal(STAGE_COPY["your-team"].helpHref, "/help/setup-your-team");
    assert.equal(STAGE_COPY.financials.helpHref, "/help/setup-financials");
  });

  it("describes Bring Your Business as cutover after Calendar foundations", () => {
    const copy = STAGE_COPY["bring-your-business"].whatToDo.toLowerCase();
    assert.match(copy, /calendar & availability/);
    assert.match(copy, /start fresh/);
    assert.match(copy, /bring your business|migration|move/i);
  });
});
