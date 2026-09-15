import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeWebsiteGalleryPhotos,
  resolveWebsiteGalleryPhotos,
  seedWebsiteGalleryPhotosIfEmpty,
} from "@/lib/wedding-website/resolve-gallery-photos";

describe("resolveWebsiteGalleryPhotos", () => {
  it("returns authored gallery unchanged when present (no silent truncation)", () => {
    const photos = ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"];
    assert.deepEqual(
      resolveWebsiteGalleryPhotos({
        galleryPhotos: photos,
        coverPhoto: "cover.jpg",
        engagementPhotos: ["e1.jpg"],
      }),
      photos,
    );
  });

  it("falls back to cover + engagement when gallery is empty", () => {
    assert.deepEqual(
      resolveWebsiteGalleryPhotos({
        galleryPhotos: [],
        coverPhoto: "cover.jpg",
        engagementPhotos: ["e1.jpg", "e2.jpg", "e3.jpg", "e4.jpg", "e5.jpg"],
      }),
      ["cover.jpg", "e1.jpg", "e2.jpg", "e3.jpg", "e4.jpg", "e5.jpg"],
    );
  });

  it("does not invent a fixed three-up of the cover alone when engagement exists", () => {
    const result = resolveWebsiteGalleryPhotos({
      galleryPhotos: null,
      coverPhoto: "cover.jpg",
      engagementPhotos: ["e1.jpg", "e2.jpg"],
    });
    assert.equal(result.length, 3);
    assert.deepEqual(result, ["cover.jpg", "e1.jpg", "e2.jpg"]);
  });
});

describe("seedWebsiteGalleryPhotosIfEmpty", () => {
  it("leaves an authored gallery untouched even when engagement has more URLs", () => {
    assert.deepEqual(
      seedWebsiteGalleryPhotosIfEmpty({
        galleryPhotos: ["a.jpg", "b.jpg", "c.jpg"],
        coverPhoto: "cover.jpg",
        engagementPhotos: ["a.jpg", "d.jpg", "e.jpg", "f.jpg"],
      }),
      ["a.jpg", "b.jpg", "c.jpg"],
    );
  });

  it("seeds from cover + engagement only when gallery is empty", () => {
    assert.deepEqual(
      seedWebsiteGalleryPhotosIfEmpty({
        galleryPhotos: [],
        coverPhoto: "cover.jpg",
        engagementPhotos: ["e1.jpg", "e2.jpg"],
      }),
      ["cover.jpg", "e1.jpg", "e2.jpg"],
    );
  });
});

describe("mergeWebsiteGalleryPhotos", () => {
  it("unions authored gallery with engagement uploads without duplicates", () => {
    assert.deepEqual(
      mergeWebsiteGalleryPhotos({
        galleryPhotos: ["a.jpg", "b.jpg"],
        coverPhoto: "a.jpg",
        engagementPhotos: ["b.jpg", "c.jpg", "d.jpg"],
      }),
      ["a.jpg", "b.jpg", "c.jpg", "d.jpg"],
    );
  });
});
