import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("Migration Center source retention does not block row staging", () => {
  it("addMigrationRowsAction runs before uploadSourceFile in handleStartAndUpload", () => {
    const ui = readFileSync("components/settings/migration-center.tsx", "utf8");
    const start = ui.indexOf("async function handleStartAndUpload");
    const end = ui.indexOf("function handleContinueProcessing", start);
    const body = ui.slice(start, end);
    const addAt = body.indexOf("addMigrationRowsAction");
    const uploadAt = body.indexOf("uploadSourceFile(started.session.id");
    assert.ok(addAt > 0, "addMigrationRowsAction present");
    assert.ok(uploadAt > 0, "uploadSourceFile present");
    assert.ok(addAt < uploadAt, "rows must stage before source-file retention");
  });
});
