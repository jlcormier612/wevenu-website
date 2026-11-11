import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const card = readFileSync(join(root, "components/setup-hub/setup-concierge-card.tsx"), "utf8");
const overview = readFileSync(join(root, "components/setup-hub/setup-hub-overview.tsx"), "utf8");
const page = readFileSync(join(root, "app/(app)/setup-hub/page.tsx"), "utf8");
const canonicalHeart = readFileSync(join(root, "components/dashboard/luv-widget.tsx"), "utf8");
const leadLuvTitle = readFileSync(join(root, "components/leads/lead-detail.tsx"), "utf8");

describe("Setup Concierge card visual identity", () => {
  it("uses Next in setup with canonical LuvHeart, not a chat invitation", () => {
    assert.match(card, /from "@\/components\/dashboard\/luv-widget"/);
    assert.match(card, /Next in setup/);
    assert.doesNotMatch(card, /Ask Luv/);
    assert.doesNotMatch(card, /Luv on your setup/);
    assert.match(card, /LuvHeart size=\{14\}/);
  });

  it("matches the relationship Luv card heart treatment (size 14)", () => {
    assert.match(canonicalHeart, /export function LuvHeart/);
    assert.match(canonicalHeart, /fill: DUSTY_ROSE/);
    assert.match(
      leadLuvTitle,
      /<CardTitle className="text-base flex items-center gap-1\.5"><LuvHeart size=\{14\} \/> Luv<\/CardTitle>/,
    );
  });

  it("does not invent a second heart on the setup overview or page", () => {
    assert.doesNotMatch(overview, /LuvHeart|lucide-react.*Heart|<Heart/);
    assert.doesNotMatch(page, /LuvHeart|<Heart|Luv on your setup/);
    assert.doesNotMatch(card, /💗|♥|❤️/);
  });
});
