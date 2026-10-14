/**
 * Guide Completion section pills — theme-token borders (visible in dark mode).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const editor = readFileSync(
  resolve("components/guide/venue-guide-editor.tsx"),
  "utf8",
);

describe("Guide Completion pill contrast", () => {
  it("uses theme tokens instead of light-only hex inline styles", () => {
    const meter = editor.slice(
      editor.indexOf("function CompletionMeter"),
      editor.indexOf("// ── Shared components"),
    );
    assert.match(meter, /data-testid="guide-completion-pills"/);
    assert.match(meter, /data-testid=\{`guide-completion-pill-\$\{s\.key\}`\}/);
    assert.match(meter, /border-primary\/35 bg-primary\/15 text-foreground/);
    assert.match(meter, /border-border bg-muted text-muted-foreground/);
    assert.doesNotMatch(meter, /#3D5040/);
    assert.doesNotMatch(meter, /#F3F0EC/);
    assert.doesNotMatch(meter, /#5D6F5D18/);
    assert.match(meter, /rounded-full border/);
  });

  it("keeps FAQ in the shared SECTIONS pill map (no separate FAQ markup)", () => {
    const faqs = editor.slice(
      editor.indexOf('key: "faqs"'),
      editor.indexOf('key: "faqs"') + 200,
    );
    assert.match(faqs, /title: "FAQs"/);
    assert.match(editor, /SECTIONS\.map\(s =>/);
  });
});
