/**
 * Stage 1 — Leads / Vendors hospitality list foundations + warm staff canvas.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const staff = css.slice(css.indexOf(".htc-staff,"), css.indexOf("/* CRM dark remap"));
const pageHeader = readFileSync(resolve("components/shell/module-placeholder.tsx"), "utf8");
const selected = readFileSync(resolve("lib/ui/selected-state.ts"), "utf8");
const leadsPage = readFileSync(resolve("app/(app)/leads/page.tsx"), "utf8");
const leadList = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
const pipelinePage = readFileSync(resolve("app/(app)/leads/pipeline/page.tsx"), "utf8");
const vendorsPage = readFileSync(resolve("app/(app)/vendors/page.tsx"), "utf8");
const vendorList = readFileSync(resolve("components/vendors/vendor-list.tsx"), "utf8");
const requiredCats = readFileSync(
  resolve("components/vendors/required-vendor-categories-panel.tsx"),
  "utf8",
);
const luvSpot = readFileSync(resolve("components/luv/spot-pattern-recommendations.tsx"), "utf8");
const dashboardPage = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
const clientsPage = readFileSync(resolve("app/(app)/clients/page.tsx"), "utf8");
const offeringsPage = readFileSync(resolve("components/offerings/offerings-page-client.tsx"), "utf8");
const leadDetail = readFileSync(resolve("app/(app)/leads/[id]/page.tsx"), "utf8");
const vendorDetail = readFileSync(resolve("app/(app)/vendors/[id]/page.tsx"), "utf8");

describe("Stage 1 — warm staff canvas foundations", () => {
  it("sets staff --background to approved warm canvas under .htc-staff only", () => {
    assert.match(staff, /--background:\s*#f8f7f3/i);
    assert.match(staff, /--htc-canvas:\s*#f8f7f3/i);
    assert.doesNotMatch(staff, /--background:\s*#fafcfa/i);
  });

  it("keeps PageHeader on Cormorant heading typography", () => {
    assert.match(pageHeader, /font-heading/);
    assert.match(pageHeader, /text-3xl/);
  });

  it("keeps idle filter chips white against warm canvas", () => {
    assert.match(selected, /IDLE_CHIP[\s\S]*bg-card/);
    assert.doesNotMatch(selected, /IDLE_CHIP[\s\S]*bg-background/);
  });

  it("does not rewrite the dark staff remap block", () => {
    const dark = css.slice(css.indexOf("/* CRM dark remap"));
    assert.match(dark, /\.dark \.htc-staff/);
    assert.match(dark, /--background:\s*var\(--htc-botanical\)/);
  });
});

describe("Stage 1 — Leads list hospitality", () => {
  it("opts Leads list into hospitality page + heading", () => {
    assert.match(leadsPage, /htc-hospitality-page/);
    assert.match(leadsPage, /htc-hospitality-heading/);
  });

  it("uses hospitality toolbar and table on LeadList", () => {
    assert.match(leadList, /htc-hospitality-toolbar/);
    assert.match(leadList, /htc-hospitality-table/);
    assert.match(leadList, /SELECTED_CHIP/);
    assert.match(leadList, /IDLE_CHIP/);
  });

  it("keeps Luv spot panel as blush accent on linen body — not a full blush wash", () => {
    assert.match(luvSpot, /--htc-linen/);
    assert.match(luvSpot, /--htc-soft-blush/);
    assert.match(luvSpot, /data-luv-accent/);
    assert.match(luvSpot, /data-luv-spot-panel/);
    assert.doesNotMatch(
      luvSpot,
      /bg-\[var\(--htc-soft-blush\)\] px-4/,
    );
  });

  it("applies shared foundations to Pipeline without board redesign markers", () => {
    assert.match(pipelinePage, /htc-hospitality-page/);
    assert.match(pipelinePage, /htc-hospitality-heading/);
    assert.match(pipelinePage, /PipelineBoard/);
  });

  it("does not wrap Lead detail in hospitality list chrome", () => {
    assert.doesNotMatch(leadDetail, /htc-hospitality-page/);
  });
});

describe("Stage 1 — Vendors list hospitality", () => {
  it("opts Vendors list into hospitality page + heading", () => {
    assert.match(vendorsPage, /htc-hospitality-page/);
    assert.match(vendorsPage, /htc-hospitality-heading/);
  });

  it("uses hospitality toolbar and table on VendorList", () => {
    assert.match(vendorList, /htc-hospitality-toolbar/);
    assert.match(vendorList, /htc-hospitality-table/);
    assert.match(vendorList, /SELECTED_CHIP/);
  });

  it("gives required categories a restrained eucalyptus header support surface", () => {
    assert.match(requiredCats, /--htc-eucalyptus-surface/);
    assert.match(requiredCats, /data-vendor-required-categories/);
  });

  it("does not wrap Vendor detail in hospitality list chrome", () => {
    assert.doesNotMatch(vendorDetail, /htc-hospitality-page/);
  });
});

describe("Stage 1 — approved pages remain hospitality", () => {
  it("keeps Dashboard / Clients / Offerings hospitality page markers", () => {
    assert.match(dashboardPage, /htc-hospitality-page/);
    assert.match(clientsPage, /htc-hospitality-page/);
    assert.match(offeringsPage, /htc-hospitality-page/);
  });
});
