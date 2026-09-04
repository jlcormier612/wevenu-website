/**
 * Floor Plan Phase 3 — matching / scope / reconciliation unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildNormalizedFloorPlanImport,
  evaluateFloorPlanMatch,
  isFloorPlanImportFileName,
  matchEventCandidates,
  matchSpaceCandidates,
  proposeFloorPlanScopeFromFileName,
} from "@/lib/migration/floor-plan-import";
import { mapCategory } from "@/lib/document-workspace/normalize";
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";

describe("floor plan import matching", () => {
  const spaces = [
    { id: "s1", name: "Ballroom" },
    { id: "s2", name: "Garden Terrace" },
  ];
  const events = [
    { id: "e1", name: "Smith Wedding", eventDate: "2026-10-17" },
    { id: "e2", name: "Jones Reception", eventDate: "2026-10-17" },
    { id: "e3", name: "Chen Gala", eventDate: "2026-11-01" },
  ];

  it("proposes Space master when the filename contains a known Space", () => {
    const p = proposeFloorPlanScopeFromFileName("ballroom-layout.pdf", ["Ballroom", "Garden Terrace"]);
    assert.equal(p.scope, "space_master");
    assert.equal(p.spaceName, "Ballroom");
  });

  it("proposes Event-specific when a date is in the filename", () => {
    const p = proposeFloorPlanScopeFromFileName("smith-2026-10-17.pdf", []);
    assert.equal(p.scope, "event_specific");
    assert.equal(p.eventDate, "2026-10-17");
  });

  it("defaults ambiguous filenames to general reference", () => {
    const p = proposeFloorPlanScopeFromFileName("scan001.png", []);
    assert.equal(p.scope, "general_reference");
  });

  it("prefills a single exact Space match as validated", () => {
    const n = buildNormalizedFloorPlanImport({
      fileName: "ballroom.pdf",
      storagePath: "v/fp/a.pdf",
      storageUrl: "https://x/a.pdf",
      scope: "space_master",
      spaceName: "Ballroom",
    });
    const outcome = evaluateFloorPlanMatch(n, spaces, events);
    assert.equal(outcome.status, "validated");
    assert.equal(outcome.patch.spaceId, "s1");
    assert.equal(outcome.matchType, "exact");
  });

  it("requires review when multiple Spaces match", () => {
    const multi = [
      { id: "a", name: "Hall A" },
      { id: "b", name: "Hall B" },
    ];
    const n = buildNormalizedFloorPlanImport({
      fileName: "hall.pdf",
      storagePath: "v/fp/b.pdf",
      storageUrl: "https://x/b.pdf",
      scope: "space_master",
      spaceName: "Hall",
    });
    const outcome = evaluateFloorPlanMatch(n, multi, events);
    assert.equal(outcome.status, "needs_review");
    assert.ok(outcome.validationErrors?.[0]?.includes("Multiple Spaces"));
  });

  it("requires review when an Event date matches more than one Event", () => {
    const n = buildNormalizedFloorPlanImport({
      fileName: "layout-2026-10-17.pdf",
      storagePath: "v/fp/c.pdf",
      storageUrl: "https://x/c.pdf",
      scope: "event_specific",
      eventDate: "2026-10-17",
    });
    const outcome = evaluateFloorPlanMatch(n, spaces, events);
    assert.equal(outcome.status, "needs_review");
    assert.equal(matchEventCandidates({ eventDate: "2026-10-17" }, events).length, 2);
  });

  it("prefills a unique Event date match", () => {
    const n = buildNormalizedFloorPlanImport({
      fileName: "chen-2026-11-01.pdf",
      storagePath: "v/fp/d.pdf",
      storageUrl: "https://x/d.pdf",
      scope: "event_specific",
      eventDate: "2026-11-01",
    });
    const outcome = evaluateFloorPlanMatch(n, spaces, events);
    assert.equal(outcome.status, "validated");
    assert.equal(outcome.patch.eventId, "e3");
  });

  it("never requires Space/Event for general reference", () => {
    const n = buildNormalizedFloorPlanImport({
      fileName: "ref.pdf",
      storagePath: "v/fp/e.pdf",
      storageUrl: "https://x/e.pdf",
      scope: "general_reference",
    });
    const outcome = evaluateFloorPlanMatch(n, spaces, events);
    assert.equal(outcome.status, "validated");
    assert.equal(outcome.matchedEntityId, null);
  });

  it("accepts only floor-plan file extensions", () => {
    assert.equal(isFloorPlanImportFileName("a.pdf"), true);
    assert.equal(isFloorPlanImportFileName("a.PNG"), true);
    assert.equal(isFloorPlanImportFileName("notes.docx"), false);
  });

  it("exact space key matching is case/punctuation insensitive", () => {
    assert.equal(matchSpaceCandidates("garden terrace!", spaces).length, 1);
    assert.equal(matchSpaceCandidates("garden terrace!", spaces)[0]!.id, "s2");
  });
});

describe("floor plan import adapter + library surfacing", () => {
  it("generic CSV normalizes floor_plan rows with required storage fields", () => {
    const result = genericCsvAdapter.normalizeRow(
      {
        fileName: "ballroom.pdf",
        storagePath: "v/floor_plan/x.pdf",
        storageUrl: "https://example.test/x.pdf",
        scope: "space_master",
        spaceName: "Ballroom",
      },
      "floor_plan",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.scope, "space_master");
      assert.equal(result.normalized.fileName, "ballroom.pdf");
    }
  });

  it("Document Library maps documents.category=floor_plan into Floor Plans", () => {
    const category = mapCategory({
      docType: "document",
      id: "d1",
      name: "Ballroom master",
      category: "floor_plan",
      status: null,
      currentVersion: 1,
      ownerType: "venue",
      leadId: null,
      clientId: null,
      eventId: null,
      vendorId: null,
      relationshipName: null,
      eventName: null,
      fileUrl: "https://example.test/x.pdf",
      fileSize: 12,
      mimeType: "application/pdf",
      isCoupleVisible: false,
      isVendorVisible: false,
      uploadedByType: "venue",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    assert.equal(category, "Floor Plans");
  });

  it("migration entity check includes floor_plan", () => {
    const src = readFileSync(
      join(process.cwd(), "supabase/migrations/20261336000000_floor_plan_migration_entity.sql"),
      "utf8",
    );
    assert.match(src, /'floor_plan'/);
  });

  it("commit path creates Documents and never invents floor-plan objects", () => {
    const src = readFileSync(join(process.cwd(), "lib/migration/floor-plan-commit.ts"), "utf8");
    assert.match(src, /category:\s*"floor_plan"/);
    assert.match(src, /insertVenueDocument|insertDocument/);
    assert.match(src, /updateBackground|updateFloorPlanBackground/);
    assert.doesNotMatch(src, /insertObjects/);
  });

  it("Phase 1 edit gates wrap floor_plan migration add/commit", () => {
    const src = readFileSync(join(process.cwd(), "lib/migration/service.ts"), "utf8");
    assert.match(src, /entityType === "floor_plan"[\s\S]*canEditFloorPlans/);
    assert.match(src, /byEntityType\.floor_plan[\s\S]*canEditFloorPlans/);
    assert.match(src, /FLOOR_PLAN_EDIT_DENIED/);
  });
});

describe("floor plan ZIP expansion accounting", () => {
  it("counts non-floor-plan entries inside a ZIP as skipped (not silent)", async () => {
    const { collectFloorPlanUploadFiles } = await import("@/lib/migration/floor-plan-zip");
    const { readFileSync, existsSync } = await import("node:fs");
    const zipPath = "/tmp/fp-phase3-fixtures/floor-plans-batch.zip";
    if (!existsSync(zipPath)) return;
    const zip = new File([readFileSync(zipPath)], "batch.zip", { type: "application/zip" });
    const result = await collectFloorPlanUploadFiles([zip]);
    assert.equal(result.files.length, 4);
    assert.equal(result.skippedNonFloorPlan, 1);
    assert.ok(result.files.every((f) => !f.fileName.endsWith(".txt")));
  });
});
