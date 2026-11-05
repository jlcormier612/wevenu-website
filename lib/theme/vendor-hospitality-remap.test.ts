/**
 * Vendor portal Contemporary Botanical light remap + venue theme-toggle hide.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("vendor hospitality light remap", () => {
  it("mounts vendor accent on the staff shell without inventing a parallel palette", () => {
    const shell = read("components/vendor-app/vendor-app-shell.tsx");
    const css = read("app/globals.css");
    assert.match(shell, /htc-staff htc-vendor/);
    assert.doesNotMatch(shell, /ThemeToggle/);
    assert.match(css, /\.htc-staff\.htc-vendor/);
    assert.match(css, /--sidebar-primary:\s*var\(--htc-leaf-muted\)/);
    assert.match(css, /--htc-leaf-muted:\s*#7e9e88/i);
  });

  it("pins vendor login + claim to approved hospitality HEX (outside .htc-staff)", () => {
    const style = read("lib/theme/vendor-auth-hospitality.ts");
    const login = read("app/vendor/login/page.tsx");
    const accept = read("app/vendor/accept/page.tsx");
    const authShell = read("components/auth/auth-brand-shell.tsx");
    const forgot = read("app/(auth)/forgot-password/page.tsx");
    const reset = read("app/(auth)/reset-password/page.tsx");
    assert.match(style, /#f8f7f3/);
    assert.match(style, /#446b56/);
    assert.match(style, /#7e9e88/);
    assert.doesNotMatch(style, /heritage-sage|forest-sage/);
    assert.match(login, /VENDOR_AUTH_HOSPITALITY_STYLE/);
    assert.match(login, /data-vendor-auth-hospitality/);
    assert.match(accept, /VENDOR_AUTH_HOSPITALITY_STYLE/);
    assert.match(accept, /data-vendor-auth-hospitality/);
    assert.match(authShell, /audience === "vendor"/);
    assert.match(authShell, /VENDOR_AUTH_HOSPITALITY_STYLE/);
    assert.match(forgot, /audience=\{audience\}/);
    assert.match(reset, /audience=\{audience\}/);
  });

  it("removes legacy forest/heritage hardcodes from vendor messaging chrome", () => {
    const thread = read("components/vendor-app/vendor-conversation-thread.tsx");
    const event = read("components/vendor-app/vendor-event-workspace.tsx");
    assert.doesNotMatch(thread, /heritage-sage|forest-sage/);
    assert.doesNotMatch(event, /heritage-sage|forest-sage/);
    assert.match(thread, /bg-primary text-primary-foreground/);
    assert.match(thread, /htc-botanical/);
    assert.match(thread, /htc-blush/);
  });
});

describe("hospitality theme toggle access (launch)", () => {
  it("hides the theme toggle and forces light while keeping dark CSS remaps", () => {
    const access = read("lib/theme/htc-theme-access.ts");
    const toggle = read("components/providers/theme-toggle.tsx");
    const provider = read("components/providers/theme-provider.tsx");
    const css = read("app/globals.css");
    assert.match(access, /HTC_THEME_TOGGLE_ENABLED\s*=\s*false/);
    assert.match(toggle, /HTC_THEME_TOGGLE_ENABLED/);
    assert.match(toggle, /return null/);
    assert.match(provider, /forcedTheme/);
    assert.match(provider, /HTC_THEME_TOGGLE_ENABLED/);
    // Dark remaps preserved for later re-enable
    assert.match(css, /\.dark \.htc-staff/);
  });
});
