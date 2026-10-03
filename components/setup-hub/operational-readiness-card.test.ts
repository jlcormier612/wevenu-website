import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const card = readFileSync(join(root, "components/setup-hub/operational-readiness-card.tsx"), "utf8");
const overview = readFileSync(join(root, "components/setup-hub/setup-hub-overview.tsx"), "utf8");
const page = readFileSync(join(root, "app/(app)/setup-hub/page.tsx"), "utf8");
const canonicalHeart = readFileSync(join(root, "components/dashboard/luv-widget.tsx"), "utf8");
const leadLuvTitle = readFileSync(join(root, "components/leads/lead-detail.tsx"), "utf8");

describe("Setup page Luv visual identity", () => {
  it("reuses canonical LuvHeart next to the existing heading copy", () => {
    assert.match(card, /from "@\/components\/dashboard\/luv-widget"/);
    assert.match(
      card,
      /<CardTitle className="text-base flex items-center gap-1\.5">\s*<LuvHeart size=\{14\} \/> Luv on your setup\s*<\/CardTitle>/,
    );
    assert.doesNotMatch(card, /<CardTitle className="text-base">Luv on your setup<\/CardTitle>/);
  });

  it("matches the relationship Luv card title treatment (heart + label, size 14)", () => {
    assert.match(canonicalHeart, /export function LuvHeart/);
    assert.match(canonicalHeart, /fill: DUSTY_ROSE/);
    assert.match(
      leadLuvTitle,
      /<CardTitle className="text-base flex items-center gap-1\.5"><LuvHeart size=\{14\} \/> Luv<\/CardTitle>/,
    );
  });

  it("does not invent a second heart treatment on the setup overview or page", () => {
    assert.doesNotMatch(overview, /LuvHeart|lucide-react.*Heart|<Heart/);
    assert.doesNotMatch(page, /LuvHeart|<Heart|Luv on your setup/);
    assert.doesNotMatch(card, /💗|♥|❤️/);
  });
});
