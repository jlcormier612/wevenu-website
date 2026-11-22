import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const workspaceRoot = join(process.cwd(), "workspace");

function read(rel: string) {
  return readFileSync(join(workspaceRoot, rel), "utf8");
}

describe("workspace light-mode only (Release 2)", () => {
  it("layout forces light theme and recovers persisted dark preference", () => {
    const layout = read("app/layout.tsx");
    assert.match(layout, /forcedTheme=["']light["']/);
    assert.match(layout, /enableSystem=\{false\}/);
    assert.match(layout, /localStorage\.setItem\(["']theme["'],\s*["']light["']\)/);
    assert.match(layout, /classList\.remove\(["']dark["']\)/);
    assert.match(layout, /colorScheme:\s*["']light["']/);
    assert.doesNotMatch(layout, /enableSystem=\{true\}/);
    assert.doesNotMatch(layout, /\benableSystem\b(?!\=\{false\})/);
  });

  it("top bar has no theme toggle", () => {
    const topBar = read("components/layout/top-bar.tsx");
    assert.doesNotMatch(topBar, /ThemeToggle/);
    assert.doesNotMatch(topBar, /theme-toggle/);
  });

  it("theme toggle module is removed and chrome surfaces cannot activate dark", () => {
    const surfaces = [
      "components/layout/top-bar.tsx",
      "components/layout/app-shell.tsx",
      "components/layout/workspace-chrome.tsx",
      "components/layout/sidebar.tsx",
      "app/(app)/settings/page.tsx",
      "app/login/page.tsx",
    ];
    for (const rel of surfaces) {
      const src = read(rel);
      assert.doesNotMatch(
        src,
        /ThemeToggle|theme-toggle|setTheme\(|theme === ["']dark["']/,
        `${rel} must not activate dark mode`,
      );
    }

    assert.equal(
      existsSync(join(workspaceRoot, "components/providers/theme-toggle.tsx")),
      false,
      "theme-toggle.tsx must be deleted",
    );
  });

  it("globals keep light canvas tokens even under a stale .dark class", () => {
    const css = read("app/globals.css");
    assert.match(css, /--htc-canvas:\s*#f8f7f3/i);
    assert.match(css, /--htc-taupe:\s*#e6dfd8/i);
    assert.match(css, /--htc-primary:\s*#446b56/i);
    assert.match(css, /\.dark\s*\{[\s\S]*?--background:\s*var\(--htc-canvas\)/);
    assert.match(css, /\.dark\s*\{[\s\S]*?--foreground:\s*var\(--htc-text\)/);
  });
});
