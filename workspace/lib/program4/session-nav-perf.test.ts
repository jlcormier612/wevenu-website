/**
 * R1B nav latency guards — session dedupe + sidebar/AppShell contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sessionSrc = readFileSync(join(here, "session.ts"), "utf8");
const shellSrc = readFileSync(
  join(here, "../../components/layout/app-shell.tsx"),
  "utf8",
);
const sidebarSrc = readFileSync(
  join(here, "../../components/layout/sidebar.tsx"),
  "utf8",
);
const proxySrc = readFileSync(join(here, "../../proxy.ts"), "utf8");
const layoutSrc = readFileSync(
  join(here, "../../app/(app)/layout.tsx"),
  "utf8",
);

describe("R1B authenticated navigation session performance", () => {
  it("dedupes Supabase staff resolution with React cache()", () => {
    assert.match(sessionSrc, /import \{ cache \} from "react"/);
    assert.match(sessionSrc, /const getSupabaseSessionMember = cache\(/);
  });

  it("warms CRM store once in authenticated layout, not again in AppShell", () => {
    assert.match(layoutSrc, /await warmLiveStore\(\)/);
    assert.doesNotMatch(shellSrc, /await warmLiveStore\(\)/);
    assert.doesNotMatch(shellSrc, /from "@shared\/relationships"/);
    assert.match(shellSrc, /getSessionMember/);
    assert.match(shellSrc, /getActingMember/);
  });

  it("disables default sidebar Link prefetch stampede", () => {
    assert.match(sidebarSrc, /prefetch=\{false\}/);
    assert.match(sidebarSrc, /NAV_ITEMS/);
    for (const href of [
      "/business",
      "/sales",
      "/customer-success",
      "/support",
      "/today",
      "/settings",
    ]) {
      assert.match(
        readFileSync(join(here, "../nav.ts"), "utf8"),
        new RegExp(href.replace("/", "\\/")),
      );
    }
  });

  it("proxy skips Auth getUser when Workspace session cookie is absent", () => {
    assert.match(proxySrc, /hasWorkspaceSupabaseCookie\(request\)/);
    assert.match(
      proxySrc,
      /url && anonKey && hasWorkspaceSupabaseCookie\(request\)/,
    );
  });

  it("preserves Supabase staff auth path (no legacy_jsonl restore)", () => {
    assert.match(sessionSrc, /isSupabaseStaffAuthEnabled/);
    assert.match(sessionSrc, /createWorkspaceAuthClient/);
    assert.match(sessionSrc, /requireActiveInternalStaff/);
    assert.doesNotMatch(sessionSrc, /WORKSPACE_AUTH_PROVIDER\s*=\s*"legacy_jsonl"/);
  });
});
