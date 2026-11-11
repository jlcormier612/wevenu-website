/**
 * Customer-facing brochure surface: FAQ visibility, preview copy, photo selection.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  addBrochurePhoto,
  normalizeBrochurePhotoUrls,
  removeBrochurePhoto,
} from "@/lib/brochures/photo-layout";
import { buildBrochurePhotoLibrary, withoutBrochurePhoto } from "@/lib/brochures/photo-storage";
import { faqsForClientBrochure } from "@/lib/brochures/service";

describe("faqsForClientBrochure", () => {
  const publishedClient = {
    question: "Published client?",
    answer: "Yes",
    audience: "both",
    published: true,
  };
  const unpublishedStarter = {
    question: "Starter?",
    answer: "Not yet",
    audience: "both",
    published: false,
    source_master_key: "FAQ-01",
  } as const;
  const vendorOnly = {
    question: "Vendor load-in?",
    answer: "Dock B",
    audience: "vendors",
    published: true,
  };

  it("renders published client FAQs", () => {
    assert.deepEqual(faqsForClientBrochure([publishedClient]), [
      { question: "Published client?", answer: "Yes" },
    ]);
  });

  it("does not render unpublished FAQs (including HTC starters)", () => {
    assert.deepEqual(faqsForClientBrochure([unpublishedStarter as never]), []);
  });

  it("does not render vendor-only FAQs in a client brochure", () => {
    assert.deepEqual(faqsForClientBrochure([vendorOnly]), []);
  });

  it("authenticated and public render paths share faqsForClientBrochure", () => {
    const service = readFileSync(resolve("lib/brochures/service.ts"), "utf8");
    assert.match(service, /faqsForClientBrochure\(faqsRaw\)/);
    assert.match(service, /faqsForClientBrochure\(row\.faqs/);
    assert.equal(
      (service.match(/faqsForClientBrochure/g) ?? []).length >= 3,
      true,
    );
  });
});

describe("brochure preview has no internal captions", () => {
  it("authenticated preview and public page never inject Pulled live captions", () => {
    const previewView = readFileSync(resolve("components/brochures/brochure-preview-view.tsx"), "utf8");
    const previewPage = readFileSync(resolve("app/(app)/library/brochures/[id]/preview/page.tsx"), "utf8");
    const publicPage = readFileSync(resolve("app/brochure/[token]/page.tsx"), "utf8");
    assert.doesNotMatch(previewView, /Pulled live/);
    assert.doesNotMatch(previewView, /showLiveDataCaptions/);
    assert.doesNotMatch(previewPage, /showLiveDataCaptions/);
    assert.doesNotMatch(previewPage, /Pulled live/);
    assert.doesNotMatch(publicPage, /Pulled live/);
    assert.doesNotMatch(publicPage, /showLiveDataCaptions/);
  });
});

describe("brochure photo selection vs library", () => {
  const venue = "venue-a";
  const heroA = `https://cdn.example/storage/v1/object/public/uploads/${venue}/hero.png?t=1`;
  const heroB = `https://cdn.example/storage/v1/object/public/uploads/${venue}/hero.png?v=2`;
  const upload = `https://cdn.example/storage/v1/object/public/uploads/${venue}/brochure-photos/one.jpg`;

  it("normalizes duplicate URL query variants in photo_urls", () => {
    assert.deepEqual(normalizeBrochurePhotoUrls([heroA, heroB, upload]), [heroA, upload]);
  });

  it("does not inject venueHeroUrl as a second library card when already selected", () => {
    const library = buildBrochurePhotoLibrary(heroA, [heroB, upload], []);
    assert.equal(library.length, 2);
    assert.equal(library[0], heroB);
    assert.equal(library[1], upload);
  });

  it("remove-from-brochure drops the selected photo without needing the exact query string", () => {
    const selected = [heroB, upload];
    const next = withoutBrochurePhoto(selected, heroA);
    assert.deepEqual(next, [upload]);
    assert.deepEqual(removeBrochurePhoto(selected, heroA), [upload]);
  });

  it("adding an already-selected query variant does not duplicate", () => {
    assert.deepEqual(addBrochurePhoto([heroA], heroB), [heroA]);
  });

  it("preview composition uses brochure.photoUrls only — not venueHeroUrl injection", () => {
    const preview = readFileSync(resolve("components/brochures/brochure-preview-view.tsx"), "utf8");
    const composition = readFileSync(resolve("components/brochures/brochure-photo-composition.tsx"), "utf8");
    assert.match(preview, /brochure\.photoUrls/);
    assert.doesNotMatch(preview, /venueHeroUrl|heroImageUrl/);
    assert.match(composition, /urls/);
    assert.doesNotMatch(composition, /venueHeroUrl|heroImageUrl/);
  });
});
