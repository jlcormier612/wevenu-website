import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STUDIO_PREVIEW_COUPLE_NAME,
  STUDIO_PREVIEW_STORY_TEXT,
  mergeStudioPreviewContent,
  resolveStudioPreviewPhotos,
} from "@/lib/wedding-website/studio-preview-content";

describe("mergeStudioPreviewContent", () => {
  it("injects Emma & Jordan story when couple story is empty", () => {
    const merged = mergeStudioPreviewContent({ home: { title: "Alex & Sam" } });
    assert.equal(merged.home?.title, "Alex & Sam");
    assert.equal(merged.story?.text, STUDIO_PREVIEW_STORY_TEXT);
    assert.ok(merged.story?.text?.includes("Sweet Daisy"));
  });

  it("preserves couple story when present", () => {
    const merged = mergeStudioPreviewContent({
      home: { title: "Alex & Sam" },
      story: { text: "We wrote this ourselves." },
    });
    assert.equal(merged.story?.text, "We wrote this ourselves.");
  });

  it("defaults empty title to Emma & Jordan", () => {
    const merged = mergeStudioPreviewContent({});
    assert.equal(merged.home?.title, STUDIO_PREVIEW_COUPLE_NAME);
  });
});

describe("resolveStudioPreviewPhotos", () => {
  it("prefers distinct gallery URLs and caps at maxCount", () => {
    const photos = resolveStudioPreviewPhotos({
      galleryPhotos: ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"],
      maxCount: 4,
    });
    assert.deepEqual(photos, ["a.jpg", "b.jpg", "c.jpg", "d.jpg"]);
  });

  it("fills from cover and engagement before fillers", () => {
    const photos = resolveStudioPreviewPhotos({
      galleryPhotos: ["g1.jpg"],
      coverPhoto: "cover.jpg",
      engagementPhotos: ["e1.jpg", "e2.jpg"],
      minCount: 3,
      maxCount: 4,
    });
    assert.deepEqual(photos, ["g1.jpg", "cover.jpg", "e1.jpg", "e2.jpg"]);
  });

  it("uses ≥3 distinct filler photos when couple has none", () => {
    const photos = resolveStudioPreviewPhotos({ minCount: 3 });
    assert.ok(photos.length >= 3);
    assert.equal(new Set(photos).size, photos.length);
    assert.ok(photos.every(p => p.startsWith("data:image/svg+xml")));
  });

  it("dedupes repeated cover copies", () => {
    const photos = resolveStudioPreviewPhotos({
      galleryPhotos: ["same.jpg", "same.jpg"],
      coverPhoto: "same.jpg",
      minCount: 3,
    });
    assert.equal(photos[0], "same.jpg");
    assert.ok(photos.length >= 3);
    assert.ok(new Set(photos).size >= 3);
  });
});
