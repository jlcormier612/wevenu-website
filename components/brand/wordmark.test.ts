/**
 * Platform Wordmark must keep HTC primary brand colors in dark mode.
 * The on-dark raster samples lavender-gray and must not be theme-selected.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  HTC_LOGO_ON_DARK_PUBLIC_PATH,
  HTC_LOGO_PUBLIC_PATH,
} from "@/shared/brand/logo";

const ROOT = resolve(".");
const wm = readFileSync(resolve("components/brand/wordmark.tsx"), "utf8");
const shell = readFileSync(resolve("components/shell/workspace-shell.tsx"), "utf8");

describe("Wordmark dark-mode brand asset", () => {
  it("ships primary and on-dark files but Wordmark only references primary", () => {
    assert.equal(
      HTC_LOGO_PUBLIC_PATH,
      "/brand/hello-to-cheers-logo-primary-transparent.png",
    );
    assert.ok(existsSync(resolve(ROOT, "public" + HTC_LOGO_PUBLIC_PATH)));
    assert.ok(existsSync(resolve(ROOT, "public" + HTC_LOGO_ON_DARK_PUBLIC_PATH)));
    assert.match(wm, /HTC_LOGO_PUBLIC_PATH/);
    assert.doesNotMatch(wm, /HTC_LOGO_ON_DARK_PUBLIC_PATH/);
    assert.doesNotMatch(wm, /hello-to-cheers-logo-on-dark/);
    assert.doesNotMatch(wm, /dark:hidden|hidden dark:block/);
  });

  it("does not apply opacity or filter wash to the platform mark", () => {
    assert.doesNotMatch(wm, /opacity-|brightness-|contrast-|mix-blend|filter:/);
  });

  it("desktop sidebar Wordmark keeps existing size and placement", () => {
    assert.match(shell, /bg-sidebar/);
    assert.match(shell, /<Wordmark sizeClassName="h-\[66\.8px\] w-auto" \/>/);
  });
});
