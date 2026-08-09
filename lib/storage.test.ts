import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveImageFile, resolvePortalDocumentFile } from "./storage";

function fakeFile(name: string, type: string): File {
  return { name, type } as File;
}

describe("resolveImageFile — website / media stays images-only", () => {
  it("accepts common images", () => {
    assert.ok(resolveImageFile(fakeFile("a.jpg", "image/jpeg")));
    assert.ok(resolveImageFile(fakeFile("a.heic", "")));
  });
  it("rejects PDF", () => {
    assert.equal(resolveImageFile(fakeFile("coi.pdf", "application/pdf")), null);
    assert.equal(resolveImageFile(fakeFile("coi.pdf", "")), null);
  });
});

describe("resolvePortalDocumentFile — PDF + images for documents", () => {
  it("accepts PDF by mime or extension", () => {
    assert.deepEqual(resolvePortalDocumentFile(fakeFile("coi.pdf", "application/pdf")), {
      ext: "pdf",
      mime: "application/pdf",
    });
    assert.deepEqual(resolvePortalDocumentFile(fakeFile("coi.PDF", "")), {
      ext: "pdf",
      mime: "application/pdf",
    });
  });
  it("still accepts images", () => {
    assert.ok(resolvePortalDocumentFile(fakeFile("scan.png", "image/png")));
  });
  it("rejects non-document types", () => {
    assert.equal(resolvePortalDocumentFile(fakeFile("notes.docx", "application/msword")), null);
  });
});
