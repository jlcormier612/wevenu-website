import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  assertCustomerSafeContractContent,
  STARTER_POLICY_PLACEHOLDERS_CODE,
  STARTER_POLICY_PLACEHOLDERS_MESSAGE,
} from "@/lib/contracts/starters";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("starter-policy placeholder send warning", () => {
  const service = read("lib/contracts/service.ts");
  const send = service.slice(service.indexOf("export async function sendContract"));
  const venueSign = service.slice(service.indexOf("export async function venueSignContract"));
  const finalize = read("lib/contracts/finalize.ts");
  const action = read("app/(app)/contracts/actions.ts");
  const builder = read("components/contracts/contract-builder.tsx");
  const detail = read("components/contracts/contract-detail.tsx");
  const dialog = read("components/contracts/starter-policy-placeholder-dialog.tsx");
  const documentsTab = read("components/events/booking-documents-tab.tsx");

  it("1. send attempt with placeholders returns the warning and does not send yet", () => {
    const result = assertCustomerSafeContractContent(
      "Add your venue's approved cancellation and rescheduling policy here.",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, STARTER_POLICY_PLACEHOLDERS_CODE);
      assert.equal(result.message, STARTER_POLICY_PLACEHOLDERS_MESSAGE);
    }
    const safetyReturn = send.slice(
      send.indexOf("assertCustomerSafeContractContent(materialized.content"),
      send.indexOf("await repo.forceResolveContractContent"),
    );
    assert.match(safetyReturn, /code: safety\.code/);
    assert.doesNotMatch(safetyReturn, /forceResolveContractContent/);
    assert.doesNotMatch(safetyReturn, /updateContractStatus/);
    assert.doesNotMatch(safetyReturn, /sendContractInviteEmails/);
  });

  it("2. Go Back & Edit does not send and returns to editing", () => {
    assert.match(dialog, /Go Back & Edit/);
    assert.match(builder, /setPlaceholderWarningOpen\(false\)/);
    assert.match(builder, /setReviewOpen\(false\)/);
    assert.match(detail, /setPlaceholderWarningOpen\(false\)/);
    assert.match(detail, /setReviewOpen\(false\)/);
    assert.doesNotMatch(
      builder.slice(builder.indexOf("onGoBack="), builder.indexOf("onSendAnyway=")),
      /acknowledgePlaceholders: true/,
    );
  });

  it("3. Send Anyway reuses the existing sendContract path", () => {
    const result = assertCustomerSafeContractContent(
      "Add your venue's approved cancellation and rescheduling policy here.",
      { allowPlaceholders: true },
    );
    assert.equal(result.ok, true);
    assert.match(send, /acknowledgePlaceholders/);
    assert.match(send, /allowPlaceholders: options\?\.acknowledgePlaceholders === true/);
    assert.match(send, /forceResolveContractContent/);
    assert.match(send, /updateContractStatus\(supabase, venueId, id, "sent"/);
    assert.match(send, /sendContractInviteEmails/);
    assert.match(builder, /onSendAnyway=\{\(\) => handleSend\(true\)\}/);
    assert.match(builder, /acknowledgePlaceholders: true/);
    assert.match(action, /sendContract\(id, customMessage, options\)/);
    assert.match(dialog, /Send Anyway/);
  });

  it("4. no warning when placeholders are gone", () => {
    const result = assertCustomerSafeContractContent(
      "Venue-approved cancellation policy after legal review.",
    );
    assert.equal(result.ok, true);
    assert.match(builder, /result\.code === "STARTER_POLICY_PLACEHOLDERS"/);
    assert.match(builder, /toast\.error\(result\.message/);
  });

  it("5. genuine send prerequisites still hard-block", () => {
    const withToken = assertCustomerSafeContractContent(
      "Add your venue's approved cancellation and rescheduling policy here.\n{{unknown_token}}",
      { allowPlaceholders: true },
    );
    assert.equal(withToken.ok, false);
    if (!withToken.ok) {
      assert.equal(withToken.code, undefined);
      assert.match(withToken.message, /Unresolved details/);
    }
    assert.match(send, /executionOrigin === "external"/);
    assert.match(send, /if \(!materialized\.ok\)/);
    assert.match(
      send.slice(0, send.indexOf("assertCustomerSafeContractContent")),
      /materialized\.message/,
    );
  });

  it("venue sign and finalize do not trap a send-anyway contract on placeholders", () => {
    assert.match(venueSign, /allowPlaceholders: true/);
    assert.match(finalize, /allowPlaceholders: true/);
  });

  it("all send UI entry points use the same warning dialog", () => {
    assert.match(builder, /StarterPolicyPlaceholderDialog/);
    assert.match(detail, /StarterPolicyPlaceholderDialog/);
    assert.match(documentsTab, /StarterPolicyPlaceholderDialog/);
    assert.match(dialog, /starter-policy-placeholder-warning/);
  });

  it("heading identifies the issue once; body explains without repeating the heading", () => {
    assert.match(dialog, /<DialogTitle>Starter policy placeholders remain<\/DialogTitle>/);
    assert.match(dialog, /DialogDescription>\{STARTER_POLICY_PLACEHOLDERS_MESSAGE\}/);
    assert.equal(
      STARTER_POLICY_PLACEHOLDERS_MESSAGE,
      "This agreement still contains starter policy placeholders. Replace them with your venue's approved language before sending to a client.",
    );
    assert.notEqual("Starter policy placeholders remain", STARTER_POLICY_PLACEHOLDERS_MESSAGE);
    assert.doesNotMatch(dialog, /<DialogTitle>This agreement still contains starter policy placeholders<\/DialogTitle>/);
    const renderedTitles = [...dialog.matchAll(/<DialogTitle>([^<]*)<\/DialogTitle>/g)].map((m) => m[1]);
    assert.deepEqual(renderedTitles, ["Starter policy placeholders remain"]);
    assert.match(dialog, /Go Back & Edit/);
    assert.match(dialog, /Send Anyway/);
  });

  it("starter-policy warning dialog stacks above ArtifactReviewOverlay so Send is not trapped", () => {
    const overlay = read("components/artifacts/artifact-review-overlay.tsx");
    const uiDialog = read("components/ui/dialog.tsx");
    assert.match(overlay, /z-\[200\]/);
    assert.match(uiDialog, /z-\[250\]/);
    assert.doesNotMatch(
      uiDialog.replace(/z-\[250\]/g, ""),
      /fixed inset-0 z-50 |fixed top-1\/2 left-1\/2 z-50 /,
    );
  });
});
