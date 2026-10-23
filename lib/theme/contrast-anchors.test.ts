import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/**
 * Theme/contrast regression anchors — ensure dark-mode remaps and shared
 * controls keep readable ink, and activation stays on a light-locked surface.
 */

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("theme contrast anchors", () => {
  it("bumps muted-foreground opacity for WCAG-friendly secondary copy", () => {
    const css = read("app/globals.css");
    assert.match(
      css,
      /--muted-foreground:\s*color-mix\(in oklch, var\(--forest-sage\) 82%, transparent\)/,
    );
    assert.match(
      css,
      /--muted-foreground:\s*color-mix\(in oklch, var\(--true-white\) 86%, transparent\)/,
    );
  });

  it("forces explicit text-foreground on shared Input/Textarea/SelectTrigger", () => {
    assert.match(read("components/ui/input.tsx"), /text-foreground/);
    assert.match(read("components/ui/textarea.tsx"), /text-foreground/);
    assert.match(read("components/ui/select.tsx"), /text-foreground/);
  });

  it("locks activation to a light brand surface with semantic form controls", () => {
    const page = read("workspace/app/activate/[token]/page.tsx");
    const form = read("workspace/components/activate/activate-account-form.tsx");
    assert.match(page, /data-theme-lock="light"/);
    assert.match(page, /LIGHT_THEME_VARS/);
    assert.match(form, /ws-control/);
    assert.match(form, /text-foreground/);
    assert.doesNotMatch(form, /bg-\[var\(--true-white\)\]/);
    assert.doesNotMatch(form, /text-\[var\(--forest-sage\)\]\/85/);
  });

  it("locks client invite / public auth Wordmark shells to AuthBrandFrame light chrome", () => {
    for (const rel of [
      "app/client/accept/page.tsx",
      "app/client/accept-participant/page.tsx",
      "app/client/login/page.tsx",
      "app/join/page.tsx",
    ] as const) {
      const src = read(rel);
      assert.match(src, /AuthBrandFrame/, rel);
      assert.doesNotMatch(src, /bg-muted\/40/, rel);
    }
    const frame = read("components/auth/auth-brand-shell.tsx");
    assert.match(frame, /data-theme-lock="light"/);
    assert.match(frame, /data-auth-brand-frame/);
  });

  it("workspace dark mode remaps warm-gray but defines ws-control dark ink", () => {
    const css = read("workspace/app/globals.css");
    assert.match(css, /\.dark\s*\{[\s\S]*--warm-gray:\s*var\(--forest-sage\)/);
    assert.match(css, /\.dark \.ws-control/);
    assert.match(css, /\[data-theme-lock="light"\] input/);
  });
});
