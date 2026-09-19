import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  isLostReasonValue,
  validateLostReasonInput,
  LOST_REASONS,
} from "@/lib/leads/lost-reasons";
import {
  resolveTransitionKind,
  transitionKindForCanonical,
  transitionKindForVenueStage,
  salesStageForTransitionTarget,
} from "@/lib/leads/pipeline-stage-transition";
import { salesStageForCanonical } from "@/lib/pipeline-templates/sales-stage-bridge";
import type { PipelineStage } from "@/lib/pipeline-templates/types";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("Lost reasons vocabulary", () => {
  it("includes the standard venue reasons", () => {
    assert.deepEqual(
      LOST_REASONS.map((r) => r.value),
      ["chose_another_venue", "date_unavailable", "budget", "no_response", "cancelled", "other"],
    );
  });

  it("requires detail when reason is Other", () => {
    assert.equal(validateLostReasonInput({ reason: "other", detail: "" }), "Add a short detail when the reason is Other.");
    assert.equal(validateLostReasonInput({ reason: "other", detail: "  " }), "Add a short detail when the reason is Other.");
    assert.equal(validateLostReasonInput({ reason: "other", detail: "Changed plans" }), null);
    assert.equal(validateLostReasonInput({ reason: "budget" }), null);
  });

  it("rejects unknown reason values", () => {
    assert.equal(isLostReasonValue("budget"), true);
    assert.equal(isLostReasonValue("not_a_reason"), false);
  });
});

describe("Booked / Lost detection via reporting category", () => {
  it("detects Booked from canonical, not display name", () => {
    assert.equal(transitionKindForCanonical("booked"), "booked");
    assert.equal(
      transitionKindForVenueStage({ canonicalStage: "booked" }),
      "booked",
    );
    const custom: Pick<PipelineStage, "id" | "name" | "canonicalStage"> = {
      id: "stage-1",
      name: "Confirmed & Contracted",
      canonicalStage: "booked",
    };
    assert.equal(
      resolveTransitionKind({ targetKey: custom.id, venueStages: [custom as PipelineStage] }),
      "booked",
    );
    assert.equal(salesStageForCanonical("booked"), "booked");
  });

  it("detects Lost from lost or cancelled reporting categories", () => {
    assert.equal(transitionKindForCanonical("lost"), "lost");
    assert.equal(transitionKindForCanonical("cancelled"), "lost");
    assert.equal(
      resolveTransitionKind({
        targetKey: "lost-stage",
        venueStages: [{ id: "lost-stage", name: "Did Not Book", canonicalStage: "lost" } as PipelineStage],
      }),
      "lost",
    );
  });

  it("keeps unmapped / custom stages as normal moves", () => {
    assert.equal(transitionKindForCanonical("unmapped"), "normal");
    assert.equal(transitionKindForCanonical("proposal"), "normal");
    assert.equal(
      salesStageForTransitionTarget({
        targetKey: "s1",
        venueStages: [{ id: "s1", name: "Custom Proposal", canonicalStage: "unmapped" } as PipelineStage],
        fallback: "tour_scheduled",
      }),
      "tour_scheduled",
    );
  });
});

describe("Pipeline stage transition service contracts", () => {
  const service = read("lib/leads/service.ts");
  const actions = read("app/(app)/leads/[id]/actions.ts");
  const board = read("components/leads/pipeline-board.tsx");
  const detail = read("components/leads/lead-detail.tsx");
  const form = read("components/settings/pipeline-template-form.tsx");
  const bookedPage = read("app/(app)/clients/[id]/booked/page.tsx");
  const migration = read("supabase/migrations/20261400400000_lead_lost_reason.sql");

  it("persists lost_reason columns via migration", () => {
    assert.match(migration, /lost_reason/);
    assert.match(migration, /lost_reason_detail/);
    assert.match(migration, /lost_at/);
  });

  it("refuses silent Booked / Lost pipeline moves without confirmation paths", () => {
    const fn = service.slice(service.indexOf("export async function updateLeadPipelineStage"));
    assert.match(fn, /Moving to Booked requires confirmation/);
    assert.match(fn, /Marking a lead Lost requires a lost reason/);
    assert.doesNotMatch(
      fn.slice(0, fn.indexOf("export async function markLeadLost")),
      /allowBooked:\s*salesStage === "booked"/,
    );
  });

  it("markLeadLost requires structured reason and supports stage id", () => {
    const fn = service.slice(service.indexOf("export async function markLeadLost"));
    assert.match(fn, /validateLostReasonInput/);
    assert.match(fn, /lost:\s*\{\s*reason/);
    assert.match(fn, /That stage is not a Lost stage/);
  });

  it("confirmPipelineBookedMove converts then calls bookClient", () => {
    const fn = service.slice(service.indexOf("export async function confirmPipelineBookedMove"));
    assert.match(fn, /convertLeadToClient/);
    assert.match(fn, /bookClient/);
    assert.match(fn, /source: "manual"/);
    assert.match(fn, /That stage is not mapped to Booked/);
    assert.match(fn, /attachSelectionToBookingFile|getActiveSelectedPackageForLead/);
  });

  it("actions expose markLost and confirmBooked for board + detail parity", () => {
    assert.match(actions, /markLeadLostAction/);
    assert.match(actions, /confirmPipelineBookedMoveAction/);
  });

  it("board routes Booked and Lost through the same confirmation dialogs as detail", () => {
    assert.match(board, /PipelineBookedConfirmDialog/);
    assert.match(board, /LostReasonDialog/);
    assert.match(board, /confirmPipelineBookedMoveAction/);
    assert.match(board, /markLeadLostAction/);
    assert.match(board, /from: "booked"/);
    assert.match(detail, /PipelineBookedConfirmDialog/);
    assert.match(detail, /LostReasonDialog/);
    assert.match(detail, /confirmPipelineBookedMoveAction/);
    assert.match(detail, /markLeadLostAction/);
  });

  it("Booked celebration follows the canonical transition, not a separate handoff", () => {
    assert.match(bookedPage, /from === "booked"/);
    assert.match(bookedPage, /event\?\.bookedAt/);
    assert.match(bookedPage, /They're Booked/);
    assert.doesNotMatch(bookedPage, /Booking Started/);
  });

  it("pipeline editor Reporting Category Select has items and opens outside drag handle", () => {
    assert.match(form, /items=\{CANONICAL_STAGES\.map/);
    assert.match(form, /aria-label=\{`Reporting category/);
    assert.match(form, /draggable/);
    // Drag is on the grip handle, not the whole row — Select can receive clicks.
    const stageRow = form.slice(form.indexOf("{input.stages.map"));
    assert.match(stageRow, /aria-label="Drag to reorder"[\s\S]*?draggable/);
  });
});

describe("Booking Journey coherence after pipeline Booked", () => {
  it("Booking Journey remains derived from commercial records, not a second pipeline", () => {
    const model = read("lib/booking-journey/model.ts");
    assert.match(model, /derived presentation model/);
    assert.match(model, /isCommerciallyBooked/);
    assert.match(model, /Independent of sales_stage/);
  });

  it("conversion migrates lead tasks to the event without inventing calendar entries", () => {
    const convert = read("lib/clients/service.ts");
    const fn = convert.slice(convert.indexOf("export async function convertLeadToClient"));
    assert.match(fn, /migrateLeadTasksToEvent/);
    assert.doesNotMatch(fn.slice(0, 3500), /calendar_events|insertCalendar/);
  });
});
