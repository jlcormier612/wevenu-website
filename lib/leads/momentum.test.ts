import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  newLeadBeginningSentence,
  stillEarlySentence,
} from "@/lib/leads/momentum";

const card = readFileSync(resolve("components/luv/lead-momentum-card.tsx"), "utf8");

describe("Luv new-lead name rendering", () => {
  it("keeps first name and 'is' as discrete tokens", () => {
    assert.equal(
      newLeadBeginningSentence("Wilma"),
      "Wilma is just beginning their planning journey. There isn't enough activity yet for me to draw any conclusions.",
    );
    assert.doesNotMatch(newLeadBeginningSentence("Wilma"), /Wilmais/);
    assert.doesNotMatch(newLeadBeginningSentence("Teresa"), /Teresais/);
    assert.match(newLeadBeginningSentence("Teresa"), /^Teresa is just beginning/);
    assert.match(newLeadBeginningSentence("Mary Kate"), /^Mary Kate is just beginning/);
    assert.match(newLeadBeginningSentence("Jennifer"), /^Jennifer is just beginning/);
  });

  it("does not use the full contact name when only first name is supplied", () => {
    assert.doesNotMatch(newLeadBeginningSentence("Wilma"), /Flintstone/);
  });

  it("card renders the formatter, not adjacent JSX `{firstName} is`", () => {
    assert.match(card, /newLeadBeginningSentence\(firstName\)/);
    assert.doesNotMatch(card, /\{firstName\} is just beginning/);
    assert.doesNotMatch(card, /\{firstName\} engages/);
    assert.match(card, /stillEarlySentence\(firstName\)/);
  });

  it("still-early copy keeps the name as its own token", () => {
    assert.equal(stillEarlySentence("Wilma"), "It's still early. I'll share more as Wilma engages.");
    assert.doesNotMatch(stillEarlySentence("Wilma"), /asWilma/);
  });
});
