/**
 * Public/auth Wordmark shells must light-lock the page chrome so the primary
 * (dark olive) logo stays legible. Prior regression: client invite used
 * `bg-muted/40` without theme-lock → heritage-sage under `.dark` → illegible.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const ROOT = resolve(".");

function read(rel: string) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

/** Routes that show the platform Wordmark on a public/auth invite or login surface. */
const AUTH_WORDMARK_ROUTES = [
  "app/client/accept/page.tsx",
  "app/client/accept-participant/page.tsx",
  "app/client/login/page.tsx",
  "app/join/page.tsx",
  "app/(auth)/workspaces/page.tsx",
  "app/vendor/accept/page.tsx",
  "components/auth/auth-brand-shell.tsx",
] as const;

describe("AuthBrandFrame — primary logo on light public chrome", () => {
  it("AuthBrandFrame pins light theme tokens and warm brand page background", () => {
    const shell = read("components/auth/auth-brand-shell.tsx");
    assert.match(shell, /data-theme-lock="light"/);
    assert.match(shell, /data-auth-brand-frame/);
    assert.match(shell, /AUTH_BRAND_PAGE_STYLE|AUTH_BRAND_LIGHT_THEME_VARS/);
    assert.match(shell, /color-mix\(in oklch, var\(--linen\), var\(--taupe-dark\) 45%\)/);
    assert.match(shell, /<Wordmark forceLight/);
    assert.doesNotMatch(shell, /className="[^"]*bg-muted\/(?:40|30)/);
  });

  it("client invite / login / join / workspaces use AuthBrandFrame (not muted shell)", () => {
    for (const rel of [
      "app/client/accept/page.tsx",
      "app/client/accept-participant/page.tsx",
      "app/client/login/page.tsx",
      "app/join/page.tsx",
      "app/(auth)/workspaces/page.tsx",
    ] as const) {
      const src = read(rel);
      assert.match(src, /AuthBrandFrame/, rel);
      assert.doesNotMatch(src, /bg-muted\/40/, rel);
      assert.doesNotMatch(src, /from "@\/components\/brand\/wordmark"/, rel);
    }
  });

  it("vendor accept light-locks the outer page chrome for primary Wordmark", () => {
    const src = read("app/vendor/accept/page.tsx");
    assert.match(src, /data-theme-lock="light"/);
    assert.match(src, /AUTH_BRAND_PAGE_STYLE/);
    assert.match(src, /Wordmark forceLight/);
    assert.doesNotMatch(src, /bg-muted\/30/);
  });

  it("no AUTH_WORDMARK route places bare Wordmark on theme bg-muted page chrome", () => {
    for (const rel of AUTH_WORDMARK_ROUTES) {
      const src = read(rel);
      // Page-level muted auth shells are forbidden; nested muted cards are ok
      // only when the outer shell already light-locks (vendor accept body card).
      assert.doesNotMatch(
        src,
        /min-h-svh[^>]*bg-muted\/40|min-h-screen[^>]*bg-muted\/30/,
        rel,
      );
    }
  });
});
