import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const shell = readFileSync(resolve("components/portal/portal-shell.tsx"), "utf8");
const bell = readFileSync(resolve("components/shell/notification-bell.tsx"), "utf8");
const header = readFileSync(resolve("marketing/components/marketing/site-header.tsx"), "utf8");

describe("M-01 client portal mobile nav", () => {
  it("keeps the desktop tab row and adds a compact nav below lg", () => {
    assert.match(shell, /data-portal-nav="desktop"/);
    assert.match(shell, /hidden max-w-6xl px-2 sm:px-3 lg:block/);
    assert.match(shell, /flex min-w-0 flex-1 items-center justify-center gap-1/);
    assert.match(shell, /item\.shortLabel \?\? item\.label/);
    assert.match(shell, /data-portal-nav="mobile"/);
    assert.match(shell, /lg:hidden/);
    assert.match(shell, /PORTAL_MOBILE_PRIMARY_IDS = \["overview", "tasks", "messages", "payments"\]/);
    assert.match(shell, /data-portal-more-trigger/);
    assert.match(shell, /data-portal-more-item/);
    assert.match(shell, /SheetContent side="left"/);
    assert.doesNotMatch(shell, /bottom nav|fixed bottom-0/);
  });

  it("does not drop destinations from the existing nav list", () => {
    for (const id of [
      "overview",
      "tasks",
      "timeline",
      "documents",
      "floor_plans",
      "event-order",
      "choices",
      "payments",
      "messages",
      "guide",
      "vendors",
    ]) {
      assert.match(shell, new RegExp(`id: "${id}"`));
    }
    assert.match(shell, /mobileMoreItems = navItems\.filter/);
  });
});

describe("M-02 export leaves the narrow identity row", () => {
  it("keeps export in the desktop header and in the mobile menu", () => {
    assert.match(shell, /data-portal-export="header"/);
    assert.match(shell, /hidden text-\[11px\].*lg:inline|lg:inline/);
    assert.match(shell, /data-portal-export="menu"/);
    assert.match(shell, /Export my data/);
    assert.match(shell, /\/api\/portal\/export\?token=/);
  });
});

describe("M-03 venue notification panel clamp", () => {
  it("keeps the 340px desktop panel and clamps it inside a phone viewport", () => {
    assert.match(bell, /w-\[340px\]/);
    assert.match(bell, /max-sm:fixed/);
    assert.match(bell, /max-sm:inset-x-2/);
    assert.match(bell, /max-sm:w-auto/);
    assert.match(bell, /Mark all read/);
  });
});

describe("M-05 marketing logo fits a 320px header", () => {
  it("lets the logo shrink below md and restores the desktop width", () => {
    assert.match(header, /w-\[230px\]/);
    assert.match(header, /max-w-\[calc\(100%-3\.5rem\)\]/);
    assert.match(header, /md:w-\[276px\]/);
    assert.match(header, /md:max-w-none md:shrink-0/);
    assert.match(header, /lg:hidden/);
    assert.match(header, /aria-label=\{open \? "Close menu" : "Open menu"\}/);
  });
});
