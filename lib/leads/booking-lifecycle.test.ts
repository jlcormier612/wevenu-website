import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  isManuallyAssignableSalesStage,
  SALES_PIPELINE_RETURN_STAGE,
  SALES_STAGE_META,
} from "@/lib/leads/sales-stages";

const root = resolve(process.cwd());
const service = readFileSync(resolve(root, "lib/leads/service.ts"), "utf8");
const detail = readFileSync(resolve(root, "components/leads/lead-detail.tsx"), "utf8");
const board = readFileSync(resolve(root, "components/leads/pipeline-board.tsx"), "utf8");
const actions = readFileSync(resolve(root, "app/(app)/leads/[id]/actions.ts"), "utf8");
const clientsSvc = readFileSync(resolve(root, "lib/clients/service.ts"), "utf8");

describe("Sales → Booking lifecycle product rules", () => {
  it("uses new_inquiry as the deliberate Sales Pipeline return destination", () => {
    assert.equal(SALES_PIPELINE_RETURN_STAGE, "new_inquiry");
  });

  it("Booked is not a free pipeline drag; confirmation is required", () => {
    assert.equal(isManuallyAssignableSalesStage("booked"), false);
    assert.equal(isManuallyAssignableSalesStage(SALES_PIPELINE_RETURN_STAGE), true);
    assert.match(service, /Move to Booked requires confirmation|allowBooked/);
  });

  it("pipeline booked means the canonical booking transition", () => {
    const booked = SALES_STAGE_META.find((s) => s.value === "booked");
    assert.ok(booked);
    assert.equal(booked!.label, "Booked");
    assert.match(booked!.description, /booking transition is complete/i);
  });

  it("server requires allowLeaveBooked to leave Booked for active pipeline stages", () => {
    assert.match(service, /allowLeaveBooked/);
    assert.match(service, /Use Move back to Sales Pipeline to leave Booked/);
    assert.match(service, /stage !== "lost"/);
  });

  it("moveLeadBackToSalesPipeline refuses a canonically booked client", () => {
    const fn = service.slice(service.indexOf("export async function moveLeadBackToSalesPipeline"));
    assert.match(fn, /SALES_PIPELINE_RETURN_STAGE/);
    assert.match(fn, /allowLeaveBooked:\s*true/);
    assert.match(fn, /booked_at/);
    assert.match(fn, /Cancel the event to leave Booked/);
  });

  it("returnLeadToBooked reuses bookClient", () => {
    const fn = service.slice(service.indexOf("export async function returnLeadToBooked"));
    assert.match(fn, /bookClient/);
    assert.match(fn, /source: "manual"/);
    assert.match(fn, /no client linked/i);
  });

  it("convertLeadToClient creates the workspace without pipeline Booked", () => {
    const convert = clientsSvc.slice(clientsSvc.indexOf("export async function convertLeadToClient"));
    assert.doesNotMatch(convert, /updateLeadSalesStage/);
    assert.match(convert, /existingClient/);
    assert.match(convert, /23505/);
    assert.match(convert, /markConvertedClientAsBookingFile/);
  });

  it("UI confirms Start booking file before mutation", () => {
    assert.match(detail, /Start booking file\?/);
    assert.match(detail, /not Booked until you confirm Mark as Booked/i);
    assert.match(detail, /setConfirmBookOpen\(true\)/);
    assert.match(detail, /confirmBookThisLead/);
    // Mutation runs only after confirm (and optional automation disclose), not on request.
    assert.doesNotMatch(
      detail.slice(detail.indexOf("function requestBookThisLead"), detail.indexOf("async function runStartBookingFile")),
      /startBookingFileAction/,
    );
  });

  it("UI exposes Return to Booked through the same transition", () => {
    assert.match(detail, /Return to Booked/);
    assert.match(detail, /same booking transition/i);
    assert.match(actions, /returnLeadToBookedAction/);
    assert.match(actions, /moveLeadBackToSalesPipelineAction/);
  });

  it("pipeline board confirms Mark as Booked before the canonical transition", () => {
    assert.match(board, /confirmPipelineBookedMoveAction/);
    assert.match(board, /PipelineBookedConfirmDialog/);
    assert.match(board, /from: "booked"/);
    assert.match(board, /firstTime === false/);
  });
});
