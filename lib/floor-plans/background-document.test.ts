/**
 * Floor Plan Phase 2 — document-backed backgrounds (unit tests).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  backgroundClearPatch,
  documentScopeForFloorPlanAssociation,
  isDocumentBackedBackground,
  isFloorPlanSourceMime,
  isLegacyBackgroundOnly,
  isPdfMime,
  resolveFloorPlanBackgroundImageUrl,
} from "@/lib/floor-plans/background-document";

describe("floor plan background document identity", () => {
  it("resolves the editor/render URL from background_image_url (legacy and document-backed)", () => {
    assert.equal(
      resolveFloorPlanBackgroundImageUrl({
        backgroundImageUrl: "https://cdn.example/legacy.png",
        backgroundDocumentId: null,
      }),
      "https://cdn.example/legacy.png",
    );
    assert.equal(
      resolveFloorPlanBackgroundImageUrl({
        backgroundImageUrl: "https://cdn.example/derivative.png",
        backgroundDocumentId: "doc-1",
      }),
      "https://cdn.example/derivative.png",
    );
    assert.equal(
      resolveFloorPlanBackgroundImageUrl({
        backgroundImageUrl: null,
        backgroundDocumentId: "doc-1",
      }),
      null,
    );
  });

  it("treats URL-only plans as legacy (no background_document_id)", () => {
    assert.equal(
      isLegacyBackgroundOnly({
        backgroundImageUrl: "https://cdn.example/old.png",
        backgroundDocumentId: null,
      }),
      true,
    );
    assert.equal(
      isDocumentBackedBackground({
        backgroundImageUrl: "https://cdn.example/old.png",
        backgroundDocumentId: null,
      }),
      false,
    );
  });

  it("treats plans with background_document_id as document-backed", () => {
    assert.equal(
      isDocumentBackedBackground({
        backgroundImageUrl: "https://cdn.example/same.png",
        backgroundDocumentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }),
      true,
    );
    assert.equal(
      isLegacyBackgroundOnly({
        backgroundImageUrl: "https://cdn.example/same.png",
        backgroundDocumentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }),
      false,
    );
  });

  it("clears both render URL and Document FK together", () => {
    assert.deepEqual(backgroundClearPatch(), {
      backgroundImageUrl: null,
      backgroundDocumentId: null,
      backgroundImageOpacity: 0.25,
    });
  });

  it("accepts images and PDF as floor-plan source files", () => {
    assert.equal(isFloorPlanSourceMime("image/png"), true);
    assert.equal(isFloorPlanSourceMime("image/jpeg"), true);
    assert.equal(isFloorPlanSourceMime("application/pdf"), true);
    assert.equal(isFloorPlanSourceMime("application/msword"), false);
    assert.equal(isPdfMime("application/pdf"), true);
    assert.equal(isPdfMime("image/png"), false);
  });

  it("scopes Event plans to event documents and Space/master templates to venue-level documents", () => {
    assert.deepEqual(
      documentScopeForFloorPlanAssociation({ kind: "event", eventId: "evt-1" }),
      { entityType: "event", entityId: "evt-1" },
    );
    assert.deepEqual(
      documentScopeForFloorPlanAssociation({ kind: "venue_reference" }),
      { venueLevel: true },
    );
  });
});

describe("floor plan Phase 2 wiring seams", () => {
  const root = process.cwd();

  it("migration adds nullable background_document_id FK on plans and templates", () => {
    const src = readFileSync(
      join(root, "supabase/migrations/20261334000000_floor_plan_background_document.sql"),
      "utf8",
    );
    assert.match(src, /floor_plans[\s\S]*background_document_id[\s\S]*references public\.documents/);
    assert.match(src, /floor_plan_templates[\s\S]*background_document_id[\s\S]*references public\.documents/);
    assert.match(src, /on delete set null/);
  });

  it("event attach path inserts a canonical documents row (category floor_plan) then links the plan", () => {
    const src = readFileSync(join(root, "lib/floor-plans/service.ts"), "utf8");
    assert.match(src, /attachBackgroundDocument/);
    assert.match(src, /insertDocument/);
    assert.match(src, /category:\s*"floor_plan"/);
    assert.match(src, /updateFloorPlanBackground[\s\S]*documentId/);
    assert.match(src, /withVenueEditor/);
  });

  it("template attach path uses venue-level documents (Space / reusable master)", () => {
    const src = readFileSync(join(root, "lib/floor-plan-templates/service.ts"), "utf8");
    assert.match(src, /attachBackgroundDocument/);
    assert.match(src, /insertVenueDocument/);
    assert.match(src, /category:\s*"floor_plan"/);
    assert.match(src, /withVenueEditor/);
  });

  it("client upload stores originals in the documents bucket and PDF derivatives in floor-plans only", () => {
    const src = readFileSync(join(root, "lib/floor-plans/client-background-upload.ts"), "utf8");
    assert.match(src, /\.from\("documents"\)/);
    assert.match(src, /background-preview\.png/);
    assert.match(src, /\.from\("floor-plans"\)/);
    assert.match(src, /rasterizePdfPage1/);
    assert.match(src, /pdf\.worker\.min\.mjs/);
    // Derivative must not create a second Document
    assert.doesNotMatch(src, /insertDocument|saveDocument|category:\s*["']floor_plan["']/);
    // Worker must be a public static asset (not auth-gated by proxy matcher).
    const proxy = readFileSync(join(root, "proxy.ts"), "utf8");
    assert.match(proxy, /ico\|mjs/);
  });

  it("duplicate / apply template copies background_document_id with the render URL", () => {
    const planRepo = readFileSync(join(root, "lib/floor-plans/repository.ts"), "utf8");
    const tmplRepo = readFileSync(join(root, "lib/floor-plan-templates/repository.ts"), "utf8");
    const planSvc = readFileSync(join(root, "lib/floor-plans/service.ts"), "utf8");
    assert.match(planRepo, /background_document_id:\s*source\.backgroundDocumentId/);
    assert.match(tmplRepo, /background_document_id:\s*source\.backgroundDocumentId/);
    assert.match(planSvc, /template\.backgroundDocumentId/);
  });

  it("venue-facing editor copy says Upload Floor Plan (not implementation terms)", () => {
    const src = readFileSync(join(root, "components/floor-plan/floor-plan-editor.tsx"), "utf8");
    assert.match(src, /Upload Floor Plan/);
    assert.match(src, /Replace Floor Plan/);
    assert.doesNotMatch(src, /background_document_id/);
    assert.doesNotMatch(src, /derivative/i);
    assert.match(src, /accept="image\/\*,application\/pdf"/);
  });

  it("Phase 1 Staff/Coordinator permission gates remain on attach + background writes", () => {
    const planSvc = readFileSync(join(root, "lib/floor-plans/service.ts"), "utf8");
    const tmplSvc = readFileSync(join(root, "lib/floor-plan-templates/service.ts"), "utf8");
    const auth = readFileSync(join(root, "lib/floor-plans/authorize.ts"), "utf8");
    assert.match(auth, /canEditFloorPlans/);
    assert.match(auth, /canDeleteFloorPlanRows/);
    assert.match(planSvc, /attachBackgroundDocument[\s\S]*withVenueEditor/);
    assert.match(tmplSvc, /attachBackgroundDocument[\s\S]*withVenueEditor/);
  });
});
