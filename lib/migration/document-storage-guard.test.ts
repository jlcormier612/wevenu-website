import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { missingDocumentStorageMessage } from "@/lib/migration/document-storage-guard";

describe("migration document storage guard", () => {
  it("explains the upload-first prerequisite when the object is missing", () => {
    const msg = missingDocumentStorageMessage("venue/x/contract.pdf");
    assert.match(msg, /No file found at storage path/);
    assert.match(msg, /Upload the file/);
    assert.match(msg, /storagePath and storageUrl/);
  });

  it("document commit path asserts storage exists before insertDocument", () => {
    const src = readFileSync("lib/migration/service.ts", "utf8");
    const start = src.indexOf('if (entityType === "document")');
    assert.ok(start > 0);
    const end = src.indexOf('if (entityType === "active_commitment")', start);
    const body = src.slice(start, end);
    assert.match(body, /assertMigrationDocumentStorageExists/);
    const insertAt = body.indexOf("insertDocument");
    const assertAt = body.indexOf("assertMigrationDocumentStorageExists");
    assert.ok(assertAt >= 0 && insertAt > assertAt, "existence check must precede insertDocument");
  });
});
