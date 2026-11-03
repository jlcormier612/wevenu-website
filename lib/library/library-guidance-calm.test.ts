import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Library guidance calm tone (Color Distribution Phase 1)", () => {
  const guidance = read("components/library/library-guidance.tsx");
  const css = read("app/globals.css");

  it("adds calm to LibraryGuidanceTone without removing prior tones", () => {
    assert.match(guidance, /export type LibraryGuidanceTone = "default" \| "blush" \| "eucalyptus" \| "calm"/);
    assert.match(guidance, /default:\s*"border-border\/70 bg-muted\/30/);
    assert.match(guidance, /blush:\s*"border-\[#e8c4c8\] bg-\[#F7E9EB\]/);
    assert.match(guidance, /eucalyptus:\s*"border-\[#b7d0c0\] bg-\[#DCE8E0\]/);
    assert.match(guidance, /calm:\s*"htc-library-guidance-calm/);
    assert.match(guidance, /bg-\[var\(--htc-calm-blue\)\]/);
    assert.match(guidance, /border-\[color:var\(--htc-border-calm\)\]/);
    assert.match(guidance, /calm:\s*"bg-\[var\(--htc-calm-blue-deep\)\]"/);
  });

  it("scopes calm guidance surface under .htc-staff with locked tokens", () => {
    const block = css.slice(
      css.indexOf(".htc-staff .htc-library-guidance-calm"),
      css.indexOf(".htc-staff .htc-catalog-section"),
    );
    assert.match(block, /border-color:\s*var\(--htc-border-calm\)/);
    assert.match(block, /background:\s*var\(--htc-calm-blue\)/);
    assert.doesNotMatch(block, /#eaf1f7|#d5e1eb/i);
  });

  it("Offerings keeps blush HowItWorks and eucalyptus DependencyNote", () => {
    const offerings = read("components/offerings/offerings-page-client.tsx");
    assert.match(offerings, /LibraryHowItWorks tone="blush"/);
    assert.match(offerings, /LibraryDependencyNote[\s\S]*tone="eucalyptus"/);
    assert.doesNotMatch(offerings, /LibraryHowItWorks tone="calm"/);
  });

  it("applies calm to Library catalog HowItWorks callers", () => {
    const calmCallers = [
      "app/(app)/library/page.tsx",
      "app/(app)/library/inventory/page.tsx",
      "app/(app)/library/inventory-templates/page.tsx",
      "app/(app)/library/event-order-templates/page.tsx",
      "app/(app)/library/floor-plan-templates/page.tsx",
      "app/(app)/library/timeline-templates/page.tsx",
      "app/(app)/library/contracts/page.tsx",
      "app/(app)/library/playbooks/page.tsx",
      "app/(app)/packages/page.tsx",
      "components/qr-campaigns/qr-campaigns-page-client.tsx",
      "components/public-forms/public-forms-page-client.tsx",
    ];
    for (const file of calmCallers) {
      const src = read(file);
      assert.match(src, /LibraryHowItWorks tone="calm"/, `${file} should use tone="calm"`);
    }
  });

  it("leaves Message Templates HowItWorks on default (outside Phase 1 catalog application)", () => {
    const messages = read("app/(app)/communication/templates/page.tsx");
    assert.match(messages, /<LibraryHowItWorks>/);
    assert.doesNotMatch(messages, /LibraryHowItWorks tone=/);
  });

  it("does not retone LibraryDependencyNote callers to calm", () => {
    const inventory = read("app/(app)/library/inventory/page.tsx");
    assert.match(inventory, /LibraryHowItWorks tone="calm"/);
    const note = inventory.slice(inventory.indexOf("<LibraryDependencyNote"));
    assert.doesNotMatch(note, /tone="calm"/);
    assert.doesNotMatch(note, /\btone=/);
  });
});
