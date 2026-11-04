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

  it("applies one filled and one unfilled token pair to every section pill (FAQ not special-cased)", () => {
    const meter = editor.slice(
      editor.indexOf("function CompletionMeter"),
      editor.indexOf("// ── Shared components"),
    );
    // Single ternary — same completed vs incomplete styles for FAQs and peers.
    assert.match(
      meter,
      /done\s*\?\s*"border-primary\/35 bg-primary\/15 text-foreground"\s*:\s*"border-border bg-muted text-muted-foreground"/,
    );
    assert.equal((meter.match(/bg-primary\/15/g) ?? []).length, 1);
    assert.equal((meter.match(/bg-muted text-muted-foreground/g) ?? []).length, 1);
    assert.doesNotMatch(meter, /s\.key\s*===\s*["']faqs["']/);
    assert.doesNotMatch(meter, /faqs.*bg-primary|bg-primary.*faqs/i);
  });
});
