import assert from "node:assert/strict";
import { describe, it } from "node:test";

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

  it("wires published Help & Guides articles where they already exist", () => {
    assert.equal(
      STAGE_COPY["your-venue"].helpHref,
      "/help/getting-started-what-to-set-up-before-i-start",
    );
    assert.equal(
      STAGE_COPY["your-venue"].helpTitle,
      "What should I set up before I start?",
    );
    assert.equal(
      STAGE_COPY["your-offerings"].helpHref,
      "/help/creating-your-first-package",
    );
    assert.equal(
      STAGE_COPY["lead-capture"].helpHref,
      "/help/how-do-i-start-collecting-inquiries-from-my-website",
    );
    assert.equal(STAGE_COPY.financials.helpHref, "/help/can-couples-pay-online");
  });

  it("does not invent help links for stages without a published article", () => {
    assert.equal(STAGE_COPY["calendar-availability"].helpHref, undefined);
    assert.equal(STAGE_COPY["bring-your-business"].helpHref, undefined);
    assert.equal(STAGE_COPY["client-experience"].helpHref, undefined);
    assert.equal(STAGE_COPY["your-team"].helpHref, undefined);
  });

  it("describes Bring Your Business as a three-way choice, not CSV-only", () => {
    const copy = STAGE_COPY["bring-your-business"].whatToDo.toLowerCase();
    assert.match(copy, /another system/);
    assert.match(copy, /spreadsheet/);
    assert.match(copy, /start fresh/);
    assert.match(copy, /whether we know it by name or not/);
  });
});
