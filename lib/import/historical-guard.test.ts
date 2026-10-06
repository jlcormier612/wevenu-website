import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  IMPORT_BATCH_ASSOCIATION_FAILED,
  IMPORT_BATCH_ASSOCIATION_UNTRACKED,
  IMPORT_BATCH_REQUIRED,
  IMPORT_DUPLICATE_CHECK_FAILED,
  associationFailureError,
  decideHistoricalImportDuplicate,
  haltUntrackedHistoricalImport,
  untrackedCreatedIds,
} from "@/lib/import/historical-guard";

const csvImport = readFileSync(resolve("app/(app)/settings/import/actions.ts"), "utf8");
const adminImport = readFileSync(resolve("app/admin/onboarding/import-actions.ts"), "utf8");
const batches = readFileSync(resolve("lib/import/batches.ts"), "utf8");
const migration = readFileSync(resolve("lib/migration/service.ts"), "utf8");
const pipeline = readFileSync(resolve("lib/lead-intake/pipeline.ts"), "utf8");
const publicInquire = readFileSync(resolve("app/api/public/inquire/route.ts"), "utf8");
const publicForms = readFileSync(resolve("app/api/public/forms/submit/route.ts"), "utf8");

async function processHistoricalRows(
  rows: { id: string }[],
  find: (row: { id: string }) => Promise<{ id: string } | null>,
) {
  const created: string[] = [];
  const errors: { row: number; message: string; kind: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => find(rows[i]),
      "Skipped — matches an already-active client",
    );
    if (dup.action !== "create") {
      errors.push(dup.error);
      continue;
    }
    created.push(rows[i].id);
  }
  return { created, errors };
}

async function processTrackedImport(
  rows: { id: string }[],
  opts: {
    batch: { ok: true; id: string } | { ok: false; message: string } | null;
    find?: (row: { id: string }) => Promise<{ id: string } | null>;
    stampOk?: (id: string) => boolean;
    compensateOk?: (id: string) => boolean;
  },
) {
  const tracked = haltUntrackedHistoricalImport("venue-1", opts.batch);
  if (!tracked.ok) {
    return { imported: tracked.result.imported, created: [] as string[], errors: tracked.result.errors, batchId: tracked.result.batchId };
  }

  const created: string[] = [];
  const errors: { row: number; message: string; kind: string }[] = [];
  const find = opts.find ?? (async () => null);
  const stampOk = opts.stampOk ?? (() => true);
  const compensateOk = opts.compensateOk ?? (() => true);

  for (let i = 0; i < rows.length; i++) {
    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => find(rows[i]),
      "Skipped — matches an already-active client",
    );
    if (dup.action !== "create") {
      errors.push(dup.error);
      continue;
    }
    if (stampOk(rows[i].id)) {
      created.push(rows[i].id);
      continue;
    }
    errors.push(associationFailureError(i + 1, compensateOk(rows[i].id)));
  }

  return { imported: created.length, created, errors, batchId: tracked.batchId };
}

describe("C3 historical import duplicate detection fails closed", () => {
  it("A. duplicate exists → skip, do not create", async () => {
    const result = await processHistoricalRows(
      [{ id: "new" }],
      async () => ({ id: "existing" }),
    );
    assert.deepEqual(result.created, []);
    assert.equal(result.errors[0]?.kind, "skipped");
    assert.match(result.errors[0]?.message ?? "", /already-active client/);
  });

  it("B. no duplicate exists → create", async () => {
    const result = await processHistoricalRows(
      [{ id: "new" }],
      async () => null,
    );
    assert.deepEqual(result.created, ["new"]);
    assert.equal(result.errors.length, 0);
  });

  it("C. duplicate checker throws → do not create; row fails; other rows continue", async () => {
    const result = await processHistoricalRows(
      [{ id: "bad" }, { id: "ok" }],
      async (row) => {
        if (row.id === "bad") throw new Error("lookup failed");
        return null;
      },
    );
    assert.deepEqual(result.created, ["ok"]);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]?.kind, "error");
    assert.equal(result.errors[0]?.message, IMPORT_DUPLICATE_CHECK_FAILED);
    assert.equal(result.errors[0]?.row, 1);
  });

  it("D. live lead capture does not use this fail-closed import guard", () => {
    assert.doesNotMatch(pipeline, /historical-guard|decideHistoricalImportDuplicate|haltUntrackedHistoricalImport|acceptCreatedImportRow/);
    assert.doesNotMatch(publicInquire, /historical-guard|decideHistoricalImportDuplicate|acceptCreatedImportRow/);
    assert.doesNotMatch(publicForms, /historical-guard|decideHistoricalImportDuplicate|acceptCreatedImportRow/);
    assert.match(publicInquire, /ingestLead/);
    assert.match(csvImport, /decideHistoricalImportDuplicate/);
    assert.match(adminImport, /decideHistoricalImportDuplicate/);
    assert.doesNotMatch(csvImport, /must never block a legitimate import/);
    assert.doesNotMatch(adminImport, /must never block a legitimate import/);
  });
});

describe("C4 import success requires durable batch association", () => {
  it("1. successful import reports only batch-associated rows", async () => {
    const result = await processTrackedImport(
      [{ id: "c1" }, { id: "c2" }],
      { batch: { ok: true, id: "batch-1" } },
    );
    assert.equal(result.imported, 2);
    assert.deepEqual(result.created, ["c1", "c2"]);
    assert.equal(result.batchId, "batch-1");
    assert.equal(result.errors.length, 0);
    assert.deepEqual(untrackedCreatedIds(["c1", "c2"], ["c1", "c2"]), []);
  });

  it("2. batch creation failure creates nothing and does not report success", async () => {
    let created = false;
    const result = await processTrackedImport(
      [{ id: "c1" }],
      {
        batch: { ok: false, message: "insert failed" },
        stampOk: () => {
          created = true;
          return true;
        },
      },
    );
    assert.equal(created, false);
    assert.equal(result.imported, 0);
    assert.equal(result.batchId, null);
    assert.equal(result.errors[0]?.message, IMPORT_BATCH_REQUIRED);
  });

  it("3. stamp/association failure cannot become a successful tracked import", async () => {
    const result = await processTrackedImport(
      [{ id: "c1" }],
      {
        batch: { ok: true, id: "batch-1" },
        stampOk: () => false,
        compensateOk: () => true,
      },
    );
    assert.equal(result.imported, 0);
    assert.deepEqual(result.created, []);
    assert.equal(result.errors[0]?.kind, "error");
    assert.equal(result.errors[0]?.message, IMPORT_BATCH_ASSOCIATION_FAILED);
    assert.deepEqual(untrackedCreatedIds(["c1"], []), ["c1"]);
  });

  it("3b. stamp failure that cannot be undone is still not counted as imported", async () => {
    const result = await processTrackedImport(
      [{ id: "c1" }],
      {
        batch: { ok: true, id: "batch-1" },
        stampOk: () => false,
        compensateOk: () => false,
      },
    );
    assert.equal(result.imported, 0);
    assert.equal(result.errors[0]?.message, IMPORT_BATCH_ASSOCIATION_UNTRACKED);
  });

  it("4. partial import keeps independent valid rows and represents failed rows", async () => {
    const result = await processTrackedImport(
      [{ id: "dup" }, { id: "stamp-fail" }, { id: "ok" }],
      {
        batch: { ok: true, id: "batch-1" },
        find: async (row) => (row.id === "dup" ? { id: "existing" } : null),
        stampOk: (id) => id === "ok",
        compensateOk: () => true,
      },
    );
    assert.deepEqual(result.created, ["ok"]);
    assert.equal(result.imported, 1);
    assert.equal(result.errors.length, 2);
    assert.equal(result.errors[0]?.kind, "skipped");
    assert.equal(result.errors[1]?.message, IMPORT_BATCH_ASSOCIATION_FAILED);
  });

  it("5. rollback/history only considers rows with import_batch_id", () => {
    const rollback = batches.slice(batches.indexOf("export async function rollbackImportBatch"));
    assert.match(rollback, /\.eq\("import_batch_id", batchId\)/);
    assert.match(batches, /stamp\.ok && stamp\.stampedIds\.includes\(opts\.createdId\)/);
    assert.match(batches, /\.is\("import_batch_id", null\)/);
    assert.doesNotMatch(batches, /Could not stamp import batch on created rows:[\s\S]{0,80}return;/);
  });

  it("6. C3 still fails closed when the duplicate checker throws", async () => {
    const result = await processTrackedImport(
      [{ id: "bad" }, { id: "ok" }],
      {
        batch: { ok: true, id: "batch-1" },
        find: async (row) => {
          if (row.id === "bad") throw new Error("lookup failed");
          return null;
        },
      },
    );
    assert.deepEqual(result.created, ["ok"]);
    assert.equal(result.imported, 1);
    assert.equal(result.errors[0]?.message, IMPORT_DUPLICATE_CHECK_FAILED);
  });

  it("CSV, admin, and Migration Center accept a create only after association", () => {
    assert.match(csvImport, /acceptCreatedImportRow/);
    assert.match(adminImport, /acceptCreatedImportRow/);
    assert.match(migration, /acceptCreatedImportRow/);
    assert.doesNotMatch(csvImport, /await stampImportBatch\(/);
    assert.doesNotMatch(adminImport, /await stampImportBatch\(/);
    const couples = csvImport.slice(
      csvImport.indexOf("export async function importCouplesAction"),
      csvImport.indexOf("export async function importLeadsAction"),
    );
    const createAt = couples.indexOf("createClient_");
    const acceptAt = couples.indexOf("acceptCreatedImportRow");
    const pushAt = couples.indexOf("createdIds.push(result.clientId)");
    assert.ok(createAt >= 0 && acceptAt > createAt && pushAt > acceptAt);
  });
});
