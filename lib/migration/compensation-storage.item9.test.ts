/**
 * Item 9 — compensation must remove orphaned document storage objects.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { removeOrphanedDocumentStorage } from "@/lib/migration/active-commitment";

function storageClient(opts: {
  remainingRefs?: number;
  removeError?: { message: string } | null;
  removeThrows?: boolean;
}) {
  let removed: string[] = [];
  return {
    removed: () => removed,
    client: {
      from(table: string) {
        assert.equal(table, "documents");
        return {
          select() { return this; },
          eq() { return this; },
          then(resolveFn: (v: unknown) => unknown) {
            return resolveFn({ count: opts.remainingRefs ?? 0, error: null });
          },
        };
      },
      storage: {
        from(bucket: string) {
          assert.equal(bucket, "documents");
          return {
            async remove(paths: string[]) {
              if (opts.removeThrows) throw new Error("storage offline");
              removed = paths;
              return { data: null, error: opts.removeError ?? null };
            },
          };
        },
      },
    },
  };
}

describe("Item 9 — removeOrphanedDocumentStorage", () => {
  it("removes the storage object when no documents still reference the path", async () => {
    const { client, removed } = storageClient({ remainingRefs: 0 });
    const result = await removeOrphanedDocumentStorage(client as never, "venue/a/file.pdf");
    assert.deepEqual(result, { removed: true, skippedShared: false });
    assert.deepEqual(removed(), ["venue/a/file.pdf"]);
  });

  it("skips removal when another document still references the path", async () => {
    const { client, removed } = storageClient({ remainingRefs: 1 });
    const result = await removeOrphanedDocumentStorage(client as never, "venue/a/shared.pdf");
    assert.deepEqual(result, { removed: false, skippedShared: true });
    assert.deepEqual(removed(), []);
  });

  it("treats already-missing storage as non-fatal", async () => {
    const { client } = storageClient({
      remainingRefs: 0,
      removeError: { message: "Object not found" },
    });
    const result = await removeOrphanedDocumentStorage(client as never, "venue/a/gone.pdf");
    assert.deepEqual(result, { removed: true, skippedShared: false });
  });

  it("does not throw when storage.remove fails for other reasons", async () => {
    const { client } = storageClient({
      remainingRefs: 0,
      removeError: { message: "AccessDenied" },
    });
    const result = await removeOrphanedDocumentStorage(client as never, "venue/a/denied.pdf");
    assert.deepEqual(result, { removed: false, skippedShared: false });
  });

  it("does not throw when storage.remove throws", async () => {
    const { client } = storageClient({ remainingRefs: 0, removeThrows: true });
    const result = await removeOrphanedDocumentStorage(client as never, "venue/a/boom.pdf");
    assert.deepEqual(result, { removed: false, skippedShared: false });
  });
});

describe("Item 9 — compensate wires storage cleanup after DB delete", () => {
  it("calls deleteDocument then removeOrphanedDocumentStorage", () => {
    const src = readFileSync(resolve("lib/migration/active-commitment.ts"), "utf8");
    const compensateStart = src.indexOf("async function compensate(");
    const compensateEnd = src.indexOf("\nexport type CommitActiveCommitmentOptions", compensateStart);
    const body = src.slice(compensateStart, compensateEnd);
    assert.match(body, /documentsRepo\.deleteDocument/);
    assert.match(body, /removeOrphanedDocumentStorage/);
    const delAt = body.indexOf("documentsRepo.deleteDocument");
    const storageAt = body.indexOf("removeOrphanedDocumentStorage");
    assert.ok(delAt >= 0 && storageAt > delAt, "storage cleanup must follow DB delete");
  });
});
