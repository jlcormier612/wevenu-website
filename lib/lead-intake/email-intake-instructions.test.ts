/**
 * Settings copy must not tell venues to use marketplace controls that are not confirmed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const section = readFileSync(resolve("components/settings/email-intake-section.tsx"), "utf8");

describe("email intake venue instructions", () => {
  it("says generic intake works and marketplace names are not connections", () => {
    assert.match(section, /are not\s+connected\s+integrations/);
    assert.match(section, /stored as email intake/);
    assert.match(section, /A marketplace name in this list is not a connection/);
  });

  it("does not tell venues to add this address as a Knot, WeddingWire, or Zola recipient", () => {
    assert.doesNotMatch(section, /additional recipient/);
    assert.doesNotMatch(section, /notification recipient/);
    assert.doesNotMatch(section, /alongside your venue email/);
  });

  it("keeps WeddingWire manual forward distinct from an automatic rule", () => {
    assert.match(section, /one lead at a time/);
    assert.match(section, /not an automatic rule/);
  });

  it("does not claim the HCTG listing address is venue-editable", () => {
    assert.match(section, /does not give venues a login/);
    assert.doesNotMatch(section, /usually the venue contact email/);
  });

  it("tells venues to forward only inquiry mail and confirm in Leads", () => {
    assert.match(section, /not\s+your whole inbox/);
    assert.match(section, /Open Leads to confirm it arrived/);
  });
});
