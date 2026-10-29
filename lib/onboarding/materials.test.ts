import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  resolveWgMaterialStoragePath,
  suggestImportEntityFromFileName,
  suggestPlanningImport,
  validateWgMaterialFile,
  wgMaterialStoragePath,
} from "@/lib/onboarding/materials";

describe("validateWgMaterialFile", () => {
  it("accepts common venue document types under size limit", () => {
    const ok = validateWgMaterialFile({
      name: "Packages 2026.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 12_000,
    });
    assert.equal(ok.ok, true);
  });

  it("rejects oversized and disallowed types", () => {
    assert.equal(
      validateWgMaterialFile({ name: "x.exe", type: "application/x-msdownload", size: 10 }).ok,
      false,
    );
    assert.equal(
      validateWgMaterialFile({
        name: "big.pdf",
        type: "application/pdf",
        size: 30 * 1024 * 1024,
      }).ok,
      false,
    );
  });
});

describe("resolveWgMaterialStoragePath", () => {
  it("prefers storage_path and falls back to public URL path", () => {
    assert.equal(
      resolveWgMaterialStoragePath({ storage_path: "onboarding/v/a.pdf", public_url: null }),
      "onboarding/v/a.pdf",
    );
    assert.equal(
      resolveWgMaterialStoragePath({
        storage_path: null,
        public_url:
          "https://x.supabase.co/storage/v1/object/public/documents/onboarding/v/legacy.pdf",
      }),
      "onboarding/v/legacy.pdf",
    );
  });
});

describe("import suggestions", () => {
  it("hints packages and planning from file names without claiming completion", () => {
    assert.equal(suggestImportEntityFromFileName("Summer Packages.xlsx"), "packages");
    assert.equal(suggestPlanningImport("Wedding Planning Checklist.pdf"), true);
    assert.equal(suggestImportEntityFromFileName("random-notes.txt"), null);
  });

  it("keeps venue id as first folder under onboarding/", () => {
    const path = wgMaterialStoragePath("venue-aaa", "brochure.pdf");
    assert.match(path, /^onboarding\/venue-aaa\//);
  });
});

describe("materials access wiring", () => {
  it("operator panel uses authorized download path, not public_url", () => {
    const op = readFileSync(resolve("lib/onboarding/white-glove-operator.ts"), "utf8");
    assert.match(op, /downloadPath/);
    assert.match(op, /\/api\/admin\/onboarding\/materials\//);
    assert.doesNotMatch(op, /url: m\.public_url/);
  });

  it("upload route stores null public_url and validates files", () => {
    const route = readFileSync(
      resolve("app/api/onboarding/white-glove/materials/route.ts"),
      "utf8",
    );
    assert.match(route, /validateWgMaterialFile/);
    assert.match(route, /public_url: null/);
    assert.match(route, /remove\(\[storagePath\]\)/);
  });

  it("HQ file route signs after requireAdminUser and path prefix check", () => {
    const route = readFileSync(
      resolve("app/api/admin/onboarding/materials/[id]/file/route.ts"),
      "utf8",
    );
    assert.match(route, /requireAdminUser/);
    assert.match(route, /createDocumentsSignedUrl/);
    assert.match(route, /expectedPrefix/);
  });

  it("waiting page is resumable with materials list + edit link", () => {
    const waiting = readFileSync(
      resolve("components/onboarding/white-glove-waiting-client.tsx"),
      "utf8",
    );
    assert.match(waiting, /Materials we/);
    assert.match(waiting, /wg-waiting-upload/);
    assert.match(waiting, /edit=1/);
  });
});
