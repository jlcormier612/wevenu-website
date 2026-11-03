/**
 * Phase 10 final polish — mobile Documents rows + Reporting tab discoverability.
 * Structural seams only; preserves Phase 10 color locks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Phase 10 polish — Documents mobile rows", () => {
  const card = read("components/document-workspace/document-card.tsx");

  it("keeps white card surface and title → view wiring", () => {
    assert.match(card, /bg-card/);
    assert.match(card, /onClick=\{handleView\}[^>]*data-testid="workspace-doc-title"/);
    assert.match(card, /line-clamp-2/);
    assert.match(card, /data-htc-doc-actions="mobile"/);
    assert.match(card, /data-htc-doc-actions="desktop"/);
  });

  it("preserves all document actions across mobile overflow + desktop strip", () => {
    assert.match(card, /aria-label="Open"/);
    assert.match(card, /aria-label="View"/);
    assert.match(card, /aria-label="Details"/);
    assert.match(card, /aria-label="Version History"/);
    assert.match(card, /aria-label="More"/);
    assert.match(card, /data-testid="workspace-doc-more-mobile"/);
    assert.match(card, /Version History/);
    assert.match(card, /handlePreview/);
    assert.match(card, /handleDownload/);
    assert.match(card, /togglePin/);
    assert.match(card, /data-testid="workspace-doc-delete"/);
    assert.match(card, /LibraryDeleteConfirmDialog/);
    // Mobile consolidates secondary actions into the overflow menu
    assert.match(card, /data-htc-doc-actions="mobile"[\s\S]*?Version History/);
  });

  it("does not invent tinted row backgrounds or new accent colors", () => {
    assert.doesNotMatch(card, /htc-eucalyptus|htc-linen|bg-\[#|from-purple|blush/);
  });
});

describe("Phase 10 polish — Reporting tab discoverability", () => {
  const tabs = read("components/reporting/report-tabs.tsx");

  it("keeps all six report routes and labels", () => {
    for (const href of [
      "/reporting",
      "/reporting/sales",
      "/reporting/bookings",
      "/reporting/revenue",
      "/reporting/events",
      "/reporting/saved",
    ]) {
      assert.match(tabs, new RegExp(href.replace(/\//g, "\\/")));
    }
    for (const label of ["Overview", "Sales", "Bookings", "Revenue", "Events", "Saved"]) {
      assert.match(tabs, new RegExp(`label: "${label}"`));
    }
  });

  it("scrolls the active tab into view and exposes overflow affordances", () => {
    assert.match(tabs, /scrollActiveIntoView/);
    assert.match(tabs, /data-report-tab-active/);
    assert.match(tabs, /Show previous report tabs/);
    assert.match(tabs, /Show more report tabs/);
    assert.match(tabs, /canScrollLeft/);
    assert.match(tabs, /canScrollRight/);
    assert.match(tabs, /border-primary text-heading/);
  });

  it("reserves edge slots for chevrons so controls do not overlay tab labels", () => {
    assert.match(tabs, /data-htc-report-tabs-edge="left"/);
    assert.match(tabs, /data-htc-report-tabs-edge="right"/);
    assert.match(tabs, /needsEdgeSlots/);
    assert.match(tabs, /showLeftSlot \? "flex w-9 md:hidden" : "hidden"/);
    assert.match(tabs, /showRightSlot \? "flex w-9 md:hidden" : "hidden"/);
    assert.match(tabs, /scrollActiveIntoView/);
    // Readable tab strip is clipped inside its own overflow container — not under absolute chevrons
    assert.match(tabs, /relative min-w-0 flex-1 overflow-hidden/);
    assert.doesNotMatch(
      tabs,
      /aria-label="Show (?:previous|more) report tabs"[\s\S]{0,240}?className="[^"]*absolute/,
    );
    assert.match(tabs, /data-htc-report-tabs="scroller"/);
  });

  it("fades clipped labels inside the scroller via directional mask, only when that direction can scroll", () => {
    assert.match(tabs, /data-htc-report-tabs-fade="left"/);
    assert.match(tabs, /data-htc-report-tabs-fade="right"/);
    assert.match(tabs, /maskImage/);
    assert.match(tabs, /WebkitMaskImage/);
    assert.match(tabs, /data-htc-report-tabs-mask/);
    assert.match(tabs, /edgeFadePx = 72/);
    assert.match(tabs, /leftFade/);
    assert.match(tabs, /rightFade/);
    assert.match(tabs, /from-\[var\(--htc-canvas,#F8F7F3\)\]/);
    assert.match(tabs, /w-\[4\.5rem\] bg-gradient-to-/);
    assert.match(tabs, /from-50%/);
    assert.match(tabs, /data-htc-report-tabs-fade-cap=/);
    assert.match(tabs, /Prefer centering the active tab/);
    // Mask + overlays apply inside the scroller wrapper, not the chevron slots
    assert.match(tabs, /data-htc-report-tabs="scroller"[\s\S]*?data-htc-report-tabs-mask/);
  });

  it("does not replace tabs with a dropdown or recolor with blue/blush/eucalyptus", () => {
    assert.doesNotMatch(tabs, /\bSelect\b|DropdownMenu|htc-eucalyptus|htc-linen|blush|calm-blue|#3B82F6/);
    assert.match(tabs, /overflow-x-auto/);
  });
});
