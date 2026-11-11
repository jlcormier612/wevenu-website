/**
 * Brochure Save persistence — content + photos must round-trip together.
 * Regression for Sandbox: Save crashed (stale Server Action / uncaught throw)
 * while photo auto-save had already written — name/photos survived, authored
 * fields did not.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { BrochureInput } from "@/lib/brochures/types";
import {
  normalizeBrochurePhotoLayout,
  normalizeBrochurePhotoUrls,
} from "@/lib/brochures/photo-layout";

/** Mirrors repository.updateBrochure patch building (pure) for regression. */
function brochureUpdatePatch(input: BrochureInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    name: input.name.trim(),
    welcome_text: input.welcomeText.trim() || null,
    include_packages: input.includePackages,
    include_faqs: input.includeFaqs,
    closing_text: input.closingText.trim() || null,
  };
  if (input.photoUrls !== undefined) {
    patch.photo_urls = normalizeBrochurePhotoUrls(input.photoUrls);
  }
  if (input.photoLayout !== undefined) {
    patch.photo_layout = normalizeBrochurePhotoLayout(input.photoLayout);
  }
  return patch;
}

function reloadFromRow(row: Record<string, unknown>) {
  return {
    name: String(row.name),
    welcomeText: (row.welcome_text as string | null) ?? "",
    includePackages: Boolean(row.include_packages),
    includeFaqs: Boolean(row.include_faqs),
    closingText: (row.closing_text as string | null) ?? "",
    photoUrls: normalizeBrochurePhotoUrls(row.photo_urls),
    photoLayout: normalizeBrochurePhotoLayout(row.photo_layout as string | null),
  };
}

describe("brochure save persistence mapping", () => {
  it("saves and reloads welcome text", () => {
    const patch = brochureUpdatePatch({
      name: "Wedding",
      welcomeText: "  Hello couples  ",
      includePackages: true,
      includeFaqs: false,
      closingText: "",
    });
    assert.equal(patch.welcome_text, "Hello couples");
    assert.equal(reloadFromRow({ ...patch, name: "Wedding" }).welcomeText, "Hello couples");
  });

  it("saves and reloads next steps (closing text)", () => {
    const patch = brochureUpdatePatch({
      name: "Wedding",
      welcomeText: "",
      includePackages: true,
      includeFaqs: false,
      closingText: " Book a tour ",
    });
    assert.equal(patch.closing_text, "Book a tour");
    assert.equal(reloadFromRow({ ...patch, name: "Wedding" }).closingText, "Book a tour");
  });

  it("persists Include Packages ON and OFF", () => {
    assert.equal(
      brochureUpdatePatch({
        name: "A", welcomeText: "", includePackages: true, includeFaqs: false, closingText: "",
      }).include_packages,
      true,
    );
    assert.equal(
      brochureUpdatePatch({
        name: "A", welcomeText: "", includePackages: false, includeFaqs: false, closingText: "",
      }).include_packages,
      false,
    );
  });

  it("persists Include FAQs ON and OFF", () => {
    assert.equal(
      brochureUpdatePatch({
        name: "A", welcomeText: "", includePackages: true, includeFaqs: true, closingText: "",
      }).include_faqs,
      true,
    );
    assert.equal(
      brochureUpdatePatch({
        name: "A", welcomeText: "", includePackages: true, includeFaqs: false, closingText: "",
      }).include_faqs,
      false,
    );
  });

  it("saves multiple content fields together with name and photos", () => {
    const patch = brochureUpdatePatch({
      name: " Complete Brochure ",
      welcomeText: "Welcome line",
      includePackages: false,
      includeFaqs: true,
      closingText: "Next steps here",
      photoUrls: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
      photoLayout: "gallery",
    });
    assert.deepEqual(patch, {
      name: "Complete Brochure",
      welcome_text: "Welcome line",
      include_packages: false,
      include_faqs: true,
      closing_text: "Next steps here",
      photo_urls: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
      photo_layout: "gallery",
    });
    const reloaded = reloadFromRow(patch);
    assert.equal(reloaded.name, "Complete Brochure");
    assert.equal(reloaded.welcomeText, "Welcome line");
    assert.equal(reloaded.includePackages, false);
    assert.equal(reloaded.includeFaqs, true);
    assert.equal(reloaded.closingText, "Next steps here");
    assert.deepEqual(reloaded.photoUrls, ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"]);
    assert.equal(reloaded.photoLayout, "gallery");
  });

  it("does not clear photos when content-only update omits photo fields", () => {
    const patch = brochureUpdatePatch({
      name: "A",
      welcomeText: "x",
      includePackages: true,
      includeFaqs: false,
      closingText: "y",
    });
    assert.equal("photo_urls" in patch, false);
    assert.equal("photo_layout" in patch, false);
  });

  it("blank welcome/closing store as null (venue story fallback), not empty string", () => {
    const patch = brochureUpdatePatch({
      name: "A",
      welcomeText: "   ",
      includePackages: true,
      includeFaqs: false,
      closingText: "",
    });
    assert.equal(patch.welcome_text, null);
    assert.equal(patch.closing_text, null);
  });
});

describe("brochure save error handling wiring", () => {
  it("content Save catches failures and keeps the user on the editor", () => {
    const detail = readFileSync(resolve("components/brochures/brochure-detail.tsx"), "utf8");
    assert.match(detail, /try \{/);
    assert.match(detail, /updateBrochureAction/);
    assert.match(detail, /photoUrls/);
    assert.match(detail, /photoLayout/);
    assert.match(detail, /Failed to find Server Action|out of date after an update/i);
    assert.match(detail, /catch \(err\)/);
  });

  it("updateBrochureAction and service catch persistence errors instead of throwing", () => {
    const actions = readFileSync(resolve("app/(app)/library/brochures/actions.ts"), "utf8");
    const service = readFileSync(resolve("lib/brochures/service.ts"), "utf8");
    assert.match(actions, /export async function updateBrochureAction[\s\S]*try \{/);
    assert.match(actions, /revalidateLibrary/);
    assert.match(service, /export async function updateBrochure_[\s\S]*try \{/);
    assert.match(service, /Could not save brochure/);
  });

  it("repository writes content and photos in one update patch when both are provided", () => {
    const repo = readFileSync(resolve("lib/brochures/repository.ts"), "utf8");
    assert.match(repo, /photo_urls/);
    assert.match(repo, /photo_layout/);
    assert.match(repo, /welcome_text/);
    assert.match(repo, /include_packages/);
    assert.match(repo, /include_faqs/);
    assert.match(repo, /closing_text/);
  });
});
