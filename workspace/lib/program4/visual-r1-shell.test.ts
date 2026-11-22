/**
 * Release 1 — Workspace visual foundation source contract.
 * Tokens + shell chrome only; no CRM logic assertions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const workspaceRoot = join(process.cwd(), "workspace");
const globals = readFileSync(join(workspaceRoot, "app/globals.css"), "utf8");
const sidebar = readFileSync(join(workspaceRoot, "components/layout/sidebar.tsx"), "utf8");
const topBar = readFileSync(join(workspaceRoot, "components/layout/top-bar.tsx"), "utf8");
const chrome = readFileSync(join(workspaceRoot, "components/layout/workspace-chrome.tsx"), "utf8");
const loginPage = readFileSync(join(workspaceRoot, "app/login/page.tsx"), "utf8");
const loginForm = readFileSync(join(workspaceRoot, "components/team/login-form.tsx"), "utf8");
const rootLayout = readFileSync(join(workspaceRoot, "app/layout.tsx"), "utf8");

describe("R1 visual foundation tokens", () => {
  it("locks founder CRM palette on light canvas", () => {
    assert.match(globals, /--htc-canvas:\s*#f8f7f3/i);
    assert.match(globals, /--htc-text:\s*#292d29/i);
    assert.match(globals, /--htc-forest:\s*#4f5f4f/i);
    assert.match(globals, /--htc-primary:\s*#446b56/i);
    assert.match(globals, /--htc-primary-hover:\s*#365542/i);
    assert.match(globals, /--htc-warm-white:\s*#fffcf8/i);
    assert.match(globals, /--htc-taupe:\s*#e6dfd8/i);
    assert.match(globals, /--htc-soft-sage:\s*#e7eee8/i);
    assert.match(globals, /--htc-muted:\s*#697469/i);
    assert.match(globals, /--htc-border:\s*#ded9d1/i);
    assert.match(globals, /--htc-dusty:\s*#c9949b/i);
    assert.match(globals, /--sidebar-width:\s*14rem/);
    assert.match(globals, /--background:\s*var\(--htc-canvas\)/);
    assert.match(globals, /--sidebar:\s*var\(--htc-taupe\)/);
  });

  it("does not use forest-sage as the dark content canvas", () => {
    assert.doesNotMatch(globals, /\.dark\s*\{[^}]*--background:\s*var\(--forest-sage\)/s);
    assert.doesNotMatch(globals, /\.dark\s*\{[^}]*--warm-gray:\s*var\(--forest-sage\)/s);
  });
});

describe("R1 shell chrome", () => {
  it("preserves authentic HTC logo asset in sidebar", () => {
    assert.match(sidebar, /HTC_LOGO_PUBLIC_PATH/);
    assert.match(sidebar, /Relationship Workspace/);
    assert.match(sidebar, /ws-nav-active/);
    assert.doesNotMatch(sidebar, /Sign out \(stub\)/);
  });

  it("top bar keeps account actions without decorative slogan", () => {
    assert.doesNotMatch(topBar, /One relationship\. One timeline/);
    assert.match(topBar, /Sign out/);
    assert.match(topBar, /No new alerts/);
    assert.match(topBar, /htc-warm-white/);
  });

  it("responsive chrome provides mobile drawer controls", () => {
    assert.match(chrome, /Open navigation/);
    assert.match(chrome, /Close navigation/);
    assert.match(chrome, /md:pl-\[var\(--sidebar-width\)\]/);
    assert.match(chrome, /max-w-\[1440px\]/);
  });

  it("login uses hospitality shell and keeps password eye wiring", () => {
    assert.match(loginPage, /ws-login-shell/);
    assert.match(loginForm, /EyeOff/);
    assert.match(loginForm, /activatePasswordInputType/);
    assert.match(loginForm, /ws-btn-primary/);
    assert.doesNotMatch(loginPage, /DEMO_LOGIN/);
    assert.doesNotMatch(loginForm, /DEMO_LOGIN/);
  });

  it("defaults theme to light hospitality", () => {
    assert.match(rootLayout, /defaultTheme="light"/);
    assert.match(rootLayout, /forcedTheme="light"/);
    assert.match(rootLayout, /enableSystem=\{false\}/);
  });
});

