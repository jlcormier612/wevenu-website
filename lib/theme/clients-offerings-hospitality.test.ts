/**
 * Clients & Offerings — refined hospitality proof (warm canvas + surface hierarchy).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Clients & Offerings hospitality refinement", () => {
  const css = read("app/globals.css");
  const clientsPage = read("app/(app)/clients/page.tsx");
  const clientList = read("components/clients/client-list.tsx");
  const statusBadge = read("components/clients/client-status-badge.tsx");
  const offeringsPage = read("components/offerings/offerings-page-client.tsx");
  const offeringsSection = read("components/offerings/offerings-library-section.tsx");
  const guidance = read("components/library/library-guidance.tsx");
  const nav = read("components/shell/sidebar-nav.tsx");

  it("defines hospitality structural utilities", () => {
    assert.match(css, /\.htc-staff \.htc-hospitality-page/);
    assert.match(css, /\.htc-staff \.htc-hospitality-heading/);
    assert.match(css, /\.htc-staff \.htc-hospitality-toolbar/);
    assert.match(css, /\.htc-staff \.htc-hospitality-table/);
    assert.match(css, /\.htc-staff \.htc-catalog-section/);
    assert.match(css, /--sidebar-accent-foreground:\s*#24332b/i);
  });

  it("Clients uses warm canvas, white heading, toolbar, and attention rows", () => {
    assert.match(clientsPage, /htc-hospitality-page/);
    assert.match(clientsPage, /htc-hospitality-heading/);
    assert.match(clientList, /htc-hospitality-toolbar/);
    assert.match(clientList, /htc-hospitality-table/);
    assert.match(clientList, /data-attention/);
    assert.match(clientList, /htc-soft-blush/);
    assert.match(statusBadge, /variant="accent"/);
  });

  it("Offerings keeps blush/eucalyptus guidance and sectioned catalog", () => {
    assert.match(offeringsPage, /htc-hospitality-page/);
    assert.match(offeringsPage, /tone="blush"/);
    assert.match(offeringsPage, /tone="eucalyptus"/);
    assert.match(offeringsPage, /title="How Offerings work"/);
    assert.match(guidance, /bg-\[#F7E9EB\]/);
    assert.match(guidance, /bg-\[#DCE8E0\]/);
    assert.match(guidance, /title \?/);
    assert.match(offeringsSection, /htc-catalog-section/);
    assert.match(offeringsSection, /groupCatalogSections/);
    assert.match(offeringsSection, /data-has-children/);
    assert.doesNotMatch(offeringsSection, /htc-catalog-category-alt/);
  });

  it("Clients blush rows are gated on attentionClientIds only", () => {
    assert.match(clientList, /attentionClientIds\.has\(client\.id\)/);
    assert.match(clientList, /data-attention=\{!portalMode && needsAttention \? "true" : undefined\}/);
    assert.doesNotMatch(clientList, /data-attention=\{[^}]*index/);
  });

  it("active sidebar label stays dark (botanical bar only)", () => {
    assert.match(nav, /bg-sidebar-accent font-medium text-sidebar-foreground/);
    assert.match(nav, /before:bg-sidebar-primary/);
  });
});
