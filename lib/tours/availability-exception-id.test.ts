import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const editor = readFileSync(resolve("components/settings/tour-availability-editor.tsx"), "utf8");
const service = readFileSync(resolve("lib/tours/service.ts"), "utf8");

describe("availability editor uses the persisted exception id", () => {
  const add = editor.slice(
    editor.indexOf("function handleAddException"),
    editor.indexOf("function handleRemoveException"),
  );
  const remove = editor.slice(editor.indexOf("function handleRemoveException"));
  const insert = service.slice(service.indexOf("export async function addTourAvailabilityException"));
  const deletion = service.slice(service.indexOf("export async function removeTourAvailabilityException"));

  it("returns the inserted row id and the editor keeps that id", () => {
    assert.match(insert, /\.select\("id"\)/);
    assert.match(insert, /return \{ ok: true, id: data\.id \}/);
    assert.match(add, /const persistedId = result\.id/);
    assert.match(add, /id: persistedId/);
    assert.doesNotMatch(add, /crypto\.randomUUID/);
  });

  it("removes that persisted row and drops it from the list", () => {
    assert.match(remove, /removeTourAvailabilityExceptionAction\(id\)/);
    assert.match(remove, /prev\.filter\(\(e\) => e\.id !== id\)/);
    assert.match(deletion, /\.eq\("id", id\)/);
    assert.match(deletion, /\.eq\("venue_id", venue\.id\)/);
    assert.match(deletion, /\.select\("id"\)/);
    assert.match(deletion, /data\?\.length/);
  });

  it("makes weekly window Remove a pending form change and blocked-date Remove immediate", () => {
    assert.match(editor, /function removeWindow\(key: string\) \{\n    setWindows/);
    assert.doesNotMatch(
      editor.slice(editor.indexOf("function removeWindow"), editor.indexOf("function updateWindow")),
      /replaceTourAvailabilityWindowsAction/,
    );
    assert.match(editor, /Removing a window or turning a day off stays on this form until you click Save changes/);
    assert.match(editor, /aria-label="Remove window from this form — Save changes to apply"/);
    assert.match(editor, /Removing a blocked date is saved immediately/);
    assert.match(editor, /aria-label="Remove blocked date now"/);
    assert.match(editor, /removeTourAvailabilityExceptionAction\(id\)/);
  });
});
