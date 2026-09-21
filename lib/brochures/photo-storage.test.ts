import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  brochurePhotoObjectPath,
  buildBrochurePhotoLibrary,
  isDeletableBrochurePhoto,
  withoutBrochurePhoto,
} from "@/lib/brochures/photo-storage";

const VENUE = "venue-a";
const OTHER = "venue-b";
const file = `https://cdn.example/storage/v1/object/public/uploads/${VENUE}/brochure-photos/one.jpg`;
const hero = `https://cdn.example/storage/v1/object/public/uploads/${VENUE}/hero.jpg`;

describe("brochure photo deletion rules", () => {
  it("identifies only this venue's brochure-photo objects", () => {
    assert.equal(
      brochurePhotoObjectPath(file, VENUE),
      `${VENUE}/brochure-photos/one.jpg`,
    );
    assert.equal(brochurePhotoObjectPath(`${file}?t=1`, VENUE), `${VENUE}/brochure-photos/one.jpg`);
    assert.equal(isDeletableBrochurePhoto(file, VENUE), true);
    assert.equal(brochurePhotoObjectPath(file, OTHER), null);
    assert.equal(isDeletableBrochurePhoto(hero, VENUE), false);
    assert.equal(
      brochurePhotoObjectPath(
        `https://cdn.example/storage/v1/object/public/uploads/${VENUE}/brochure-photos/../logo.png`,
        VENUE,
      ),
      null,
    );
  });

  it("removing from the selection keeps the asset url out of photo_urls and promotes the next photo", () => {
    const urls = [`${file}?t=9`, "https://cdn.example/b.jpg", "https://cdn.example/c.jpg"];
    const next = withoutBrochurePhoto(urls, file);
    assert.deepEqual(next, ["https://cdn.example/b.jpg", "https://cdn.example/c.jpg"]);
    assert.equal(next[0], "https://cdn.example/b.jpg");
    assert.equal(withoutBrochurePhoto(["https://cdn.example/b.jpg"], file).length, 1);
  });

  it("library cards collapse venueHeroUrl query variants against selected photo_urls", () => {
    const library = buildBrochurePhotoLibrary(`${hero}?t=1`, [`${hero}?v=9`, file], []);
    assert.deepEqual(library, [`${hero}?v=9`, file]);
  });

  it("the editor distinguishes remove from delete, and a failed save is caught", () => {
    const editor = readFileSync(resolve("components/brochures/brochure-photos-editor.tsx"), "utf8");
    const detail = readFileSync(resolve("components/brochures/brochure-detail.tsx"), "utf8");
    const actions = readFileSync(resolve("app/(app)/library/brochures/actions.ts"), "utf8");
    const service = readFileSync(resolve("lib/brochures/service.ts"), "utf8");
    assert.match(editor, /Remove from brochure/);
    assert.match(editor, /Delete photo/);
    assert.match(editor, /Use in brochure/);
    assert.match(editor, /Venue photo/);
    assert.match(editor, /LibraryDeleteConfirmDialog/);
    assert.match(editor, /deleteBrochurePhotoAction/);
    assert.doesNotMatch(editor, /does not delete it from your venue/);
    assert.match(detail, /catch \(err\)/);
    assert.match(detail, /setPhotoUrls\(previous\.photoUrls\)/);
    assert.match(actions, /catch \(err\)/);
    assert.match(service, /brochurePhotoObjectPath/);
    assert.match(service, /storage\.from\("uploads"\)\.remove/);
    assert.match(service, /Could not save photos/);
  });
});
