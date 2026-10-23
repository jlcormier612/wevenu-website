/**
 * P2-D — Couple nav visibility (Documents-first).
 * Run: npx tsx --test lib/portal/couple-nav-visibility.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  coupleChoicesNavVisible,
  coupleEventOrderNavVisible,
  coupleInventoryNavVisible,
} from "@/lib/portal/couple-nav-visibility";

describe("P2-D coupleChoicesNavVisible", () => {
  it("hides when empty or only draft/finalized/submitted", () => {
    assert.equal(coupleChoicesNavVisible([]), false);
    assert.equal(coupleChoicesNavVisible([{ status: "draft" }]), false);
    assert.equal(coupleChoicesNavVisible([{ status: "finalized" }]), false);
    assert.equal(coupleChoicesNavVisible([{ status: "submitted" }]), false);
  });

  it("shows when couple must act", () => {
    assert.equal(coupleChoicesNavVisible([{ status: "sent" }]), true);
    assert.equal(coupleChoicesNavVisible([{ status: "in_progress" }]), true);
    assert.equal(coupleChoicesNavVisible([{ status: "changes_requested" }]), true);
  });
});

describe("P2-D coupleInventoryNavVisible", () => {
  it("hides when no inventory or finalized", () => {
    assert.equal(coupleInventoryNavVisible({ hasInventory: false }), false);
    assert.equal(coupleInventoryNavVisible({ hasInventory: true, status: "finalized" }), false);
  });

  it("shows for active client-facing statuses", () => {
    assert.equal(coupleInventoryNavVisible({ hasInventory: true, status: "shared" }), true);
    assert.equal(coupleInventoryNavVisible({ hasInventory: true, status: "changes_requested" }), true);
    assert.equal(coupleInventoryNavVisible({ hasInventory: true, status: "submitted" }), true);
  });
});

describe("P2-D coupleEventOrderNavVisible", () => {
  it("hides when unshared or already agreed", () => {
    assert.equal(coupleEventOrderNavVisible({ shared: false }), false);
    assert.equal(
      coupleEventOrderNavVisible({ shared: true, clientAgreedAt: "2026-10-01T00:00:00Z" }),
      false,
    );
  });

  it("shows when shared and acceptance still open", () => {
    assert.equal(
      coupleEventOrderNavVisible({ shared: true, clientAgreedAt: null }),
      true,
    );
  });
});

describe("P2-D portal shell composition", () => {
  it("gates Choices/Inventory/Order with P2-D visibility helpers", () => {
    const shell = readFileSync(resolve("components/portal/portal-shell.tsx"), "utf8");
    assert.match(shell, /coupleChoicesNavVisible/);
    assert.match(shell, /coupleInventoryNavVisible/);
    assert.match(shell, /coupleEventOrderNavVisible/);
    assert.match(shell, /Documents-first|P2-D/);
  });

  it("documents API merges shared Event Order", () => {
    const route = readFileSync(resolve("app/api/portal/documents/route.ts"), "utf8");
    assert.match(route, /get_event_order_for_portal/);
    assert.match(route, /mergeSharedEventOrderIntoCoupleDocuments/);
  });

  it("Choices stay reachable via section mount without requiring Inventory/Order nav", () => {
    const shell = readFileSync(resolve("components/portal/portal-shell.tsx"), "utf8");
    assert.match(shell, /activeSection === "choices"/);
    assert.match(shell, /ChoicesPortalSection/);
    assert.match(shell, /item\.id !== "choices" \|\| showChoicesNav/);
  });
});
