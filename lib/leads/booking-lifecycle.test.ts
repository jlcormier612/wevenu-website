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

  it("Booked is not manually assignable; move-back destination is", () => {
    assert.equal(isManuallyAssignableSalesStage("booked"), false);
    assert.equal(isManuallyAssignableSalesStage(SALES_PIPELINE_RETURN_STAGE), true);
  });

  it("Booked copy does not imply contract or payment", () => {
    const booked = SALES_STAGE_META.find((s) => s.value === "booked");
    assert.ok(booked);
    assert.doesNotMatch(booked!.description, /contract|payment|deposit|signed/i);
    assert.match(booked!.description, /won|ready|event/i);
  });

  it("server requires allowLeaveBooked to leave Booked for active pipeline stages", () => {
    assert.match(service, /allowLeaveBooked/);
    assert.match(service, /Use Move back to Sales Pipeline to leave Booked/);
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

  it("convertLeadToClient still sets Booked via allowBooked and is idempotent on existing client", () => {
    const convert = clientsSvc.slice(clientsSvc.indexOf("export async function convertLeadToClient"));
    assert.match(convert, /allowBooked:\s*true/);
    assert.match(convert, /existingClient/);
    assert.match(convert, /23505/);
  });

  it("UI confirms Book This Lead before mutation", () => {
    assert.match(detail, /Book this lead\?/);
    assert.match(detail, /doesn't necessarily mean the contract is signed/i);
    assert.match(detail, /setConfirmBookOpen\(true\)/);
    assert.match(detail, /confirmBookThisLead/);
    assert.doesNotMatch(
      detail.slice(detail.indexOf("function requestBookThisLead"), detail.indexOf("function confirmBookThisLead")),
      /convertLeadToClientAction/,
    );
  });

  it("UI exposes Move back and Return to Booked with confirmations", () => {
    assert.match(detail, /Move back to Sales Pipeline/);
    assert.match(detail, /Return to Booked/);
    assert.match(detail, /client, event, documents, messages, and financial information/i);
    assert.match(detail, /not a new first booking/i);
    assert.match(actions, /moveLeadBackToSalesPipelineAction/);
    assert.match(actions, /returnLeadToBookedAction/);
  });

  it("pipeline board blocks leaving Booked except via dedicated path", () => {
    assert.match(board, /Move back to Sales Pipeline/);
    assert.match(board, /Booked is only set by converting/);
  });
});
