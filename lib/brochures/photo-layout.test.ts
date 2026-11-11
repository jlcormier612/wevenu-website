import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  addBrochurePhoto,
  moveBrochurePhoto,
  normalizeBrochurePhotoLayout,
  photosForBrochureLayout,
  removeBrochurePhoto,
  setPrimaryBrochurePhoto,
} from "@/lib/brochures/photo-layout";

describe("Brochure photography + layouts", () => {
  const photos = [
    "https://cdn.example/a.jpg",
    "https://cdn.example/b.jpg",
    "https://cdn.example/c.jpg",
    "https://cdn.example/d.jpg",
  ];

  it("selects multiple photos, sets primary, reorders, and removes without dropping other URLs", () => {
    let urls = addBrochurePhoto([], photos[0]!);
    urls = addBrochurePhoto(urls, photos[1]!);
    urls = addBrochurePhoto(urls, photos[2]!);
    assert.deepEqual(urls, [photos[0], photos[1], photos[2]]);
    urls = setPrimaryBrochurePhoto(urls, photos[2]!);
    assert.equal(urls[0], photos[2]);
    urls = moveBrochurePhoto(urls, 1, 2);
    assert.equal(urls.length, 3);
    const removed = removeBrochurePhoto(urls, photos[0]!);
    assert.equal(removed.includes(photos[0]!), false);
    assert.equal(removed.length, 2);
  });

  it("each curated layout omits empty slots when photos are scarce", () => {
    assert.deepEqual(photosForBrochureLayout([], "classic"), { hero: null, supporting: [] });
    const one = photosForBrochureLayout([photos[0]!], "classic");
    assert.equal(one.hero, photos[0]);
    assert.equal(one.supporting.length, 0);
    const classic = photosForBrochureLayout(photos, "classic");
    assert.equal(classic.supporting.length, 2);
    const gallery = photosForBrochureLayout(photos, "gallery");
    assert.ok(gallery.supporting.length >= 2);
    const story = photosForBrochureLayout(photos, "story");
    assert.equal(story.supporting.length, 1);
    const editorial = photosForBrochureLayout(photos, "editorial");
    assert.equal(editorial.supporting.length, 3);
    assert.equal(normalizeBrochurePhotoLayout("nope"), "classic");
  });

  it("editor persists photography separately from deleting storage assets", () => {
    const editor = readFileSync(resolve("components/brochures/brochure-photos-editor.tsx"), "utf8");
    const actions = readFileSync(resolve("app/(app)/library/brochures/actions.ts"), "utf8");
    const preview = readFileSync(resolve("components/brochures/brochure-preview-view.tsx"), "utf8");
    const publicPage = readFileSync(resolve("app/brochure/[token]/page.tsx"), "utf8");
    assert.match(editor, /Add photos/);
    assert.match(editor, /uploadToStorage/);
    assert.match(editor, /listPublicUploadUrls/);
    assert.match(editor, /removeBrochurePhoto|withoutBrochurePhoto/);
    assert.match(editor, /Delete photo/);
    assert.match(editor, /Remove from brochure/);
    assert.doesNotMatch(editor, /removeFromStorage/);
    assert.match(actions, /updateBrochurePhotographyAction/);
    assert.match(preview, /BrochurePhotoComposition/);
    assert.match(preview, /brochure\.photoUrls/);
    assert.match(publicPage, /BrochurePreviewView/);
    assert.doesNotMatch(preview, /Mark accepted|sendOfferAction|sendContractAction/);
  });

  it("preview and public page share BrochurePreviewView; layouts are curated not freeform", () => {
    const composition = readFileSync(resolve("components/brochures/brochure-photo-composition.tsx"), "utf8");
    const editor = readFileSync(resolve("components/brochures/brochure-photos-editor.tsx"), "utf8");
    assert.match(composition, /layout === "classic"/);
    assert.match(composition, /layout === "gallery"/);
    assert.match(composition, /layout === "story"/);
    assert.doesNotMatch(composition, /position:\s*absolute|drag/i);
    assert.match(editor, /BROCHURE_PHOTO_LAYOUTS\.map/);
    assert.doesNotMatch(editor, /Canva|freeform|pixel/i);
  });

  it("preserves existing brochure content fields", () => {
    const detail = readFileSync(resolve("components/brochures/brochure-detail.tsx"), "utf8");
    assert.match(detail, /Welcome text/);
    assert.match(detail, /Include Packages/);
    assert.match(detail, /Include FAQs/);
    assert.match(detail, /Next steps/);
    assert.match(detail, /updateBrochureAction/);
    assert.match(detail, /BrochurePhotosEditor/);
  });
});
