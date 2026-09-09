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

  it("Booking Started is not manually assignable; move-back destination is", () => {
    assert.equal(isManuallyAssignableSalesStage("booked"), false);
    assert.equal(isManuallyAssignableSalesStage(SALES_PIPELINE_RETURN_STAGE), true);
  });

  it("Booking Started copy does not imply contract or payment complete", () => {
    const booked = SALES_STAGE_META.find((s) => s.value === "booked");
    assert.ok(booked);
    assert.equal(booked!.label, "Booking Started");
    assert.doesNotMatch(booked!.description, /deposit is paid|agreement is signed/i);
    assert.match(booked!.description, /not commercially Booked/i);
  });

  it("server requires allowLeaveBooked to leave Booking Started for active pipeline stages", () => {
    assert.match(service, /allowLeaveBooked/);
    assert.match(service, /Use Move back to Sales Pipeline to leave Booking Started/);
    assert.match(service, /stage !== "lost"/);
  });

  it("moveLeadBackToSalesPipeline targets SALES_PIPELINE_RETURN_STAGE with allowLeaveBooked", () => {
    const fn = service.slice(service.indexOf("export async function moveLeadBackToSalesPipeline"));
    assert.match(fn, /SALES_PIPELINE_RETURN_STAGE/);
    assert.match(fn, /allowLeaveBooked:\s*true/);
    assert.match(fn, /sales_stage !== "booked"/);
  });

  it("returnLeadToBooked requires linked client and uses allowBooked", () => {
    const fn = service.slice(service.indexOf("export async function returnLeadToBooked"));
    assert.match(fn, /allowBooked:\s*true/);
    assert.match(fn, /lead_id/);
    assert.match(fn, /no client linked/i);
  });

  it("convertLeadToClient still sets Booking Started via allowBooked and is idempotent on existing client", () => {
    const convert = clientsSvc.slice(clientsSvc.indexOf("export async function convertLeadToClient"));
    assert.match(convert, /allowBooked:\s*true/);
    assert.match(convert, /existingClient/);
    assert.match(convert, /23505/);
  });

  it("UI confirms Start booking file before mutation", () => {
    assert.match(detail, /Start booking file\?/);
    assert.match(detail, /not commercially Booked until/i);
    assert.match(detail, /Booking Started/);
    assert.match(detail, /setConfirmBookOpen\(true\)/);
    assert.match(detail, /confirmBookThisLead/);
    // Mutation runs only after confirm (and optional automation disclose), not on request.
    assert.doesNotMatch(
      detail.slice(detail.indexOf("function requestBookThisLead"), detail.indexOf("async function runStartBookingFile")),
      /startBookingFileAction/,
    );
  });

  it("UI exposes Move back and Return to Booking Started with confirmations", () => {
    assert.match(detail, /Move back to Sales Pipeline/);
    assert.match(detail, /Return to Booking Started/);
    assert.match(detail, /client, event, documents, messages, and financial information/i);
    assert.match(detail, /commercially Booked only after/i);
    assert.match(actions, /moveLeadBackToSalesPipelineAction/);
    assert.match(actions, /returnLeadToBookedAction/);
  });

  it("pipeline board blocks leaving Booking Started except via dedicated path", () => {
    assert.match(board, /Move back to Sales Pipeline/);
    assert.match(board, /Booking Started is only set by starting a booking file/);
  });
});
