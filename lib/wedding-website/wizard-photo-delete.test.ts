import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { afterWizardPhotoDeleted } from "@/lib/wedding-website/wizard-photo-delete";

describe("afterWizardPhotoDeleted", () => {
  const photos = [
    { id: "a", url: "https://cdn.example/a.jpg" },
    { id: "b", url: "https://cdn.example/b.jpg" },
  ];

  it("removes the deleted photo from the available set", () => {
    const result = afterWizardPhotoDeleted({
      deletedId: "b",
      deletedUrl: photos[1]!.url,
      photos,
      selectedPhotoUrl: photos[0]!.url,
      coverImageUrl: photos[0]!.url,
    });
    assert.deepEqual(result.photos.map((p) => p.id), ["a"]);
    assert.equal(result.selectedPhotoUrl, photos[0]!.url);
    assert.equal(result.clearCover, false);
  });

  it("replaces selection with remaining photo when the selected asset is deleted", () => {
    const result = afterWizardPhotoDeleted({
      deletedId: "a",
      deletedUrl: photos[0]!.url,
      photos,
      selectedPhotoUrl: photos[0]!.url,
      coverImageUrl: null,
    });
    assert.deepEqual(result.photos.map((p) => p.id), ["b"]);
    assert.equal(result.selectedPhotoUrl, photos[1]!.url);
    assert.equal(result.clearCover, false);
  });

  it("clears selection and flags cover clear when the only/cover photo is deleted", () => {
    const only = [{ id: "a", url: "https://cdn.example/a.jpg" }];
    const result = afterWizardPhotoDeleted({
      deletedId: "a",
      deletedUrl: only[0]!.url,
      photos: only,
      selectedPhotoUrl: only[0]!.url,
      coverImageUrl: only[0]!.url,
    });
    assert.deepEqual(result.photos, []);
    assert.equal(result.selectedPhotoUrl, "");
    assert.equal(result.clearCover, true);
  });
});
