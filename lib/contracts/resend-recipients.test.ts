/**
 * Contract resend recipient selection — locked multi-signatory rules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  defaultResendSelection,
  listResendRecipients,
  summarizeResendDeliveries,
  validateResendSelection,
} from "@/lib/contracts/resend-recipients";
import type { ContractSigner } from "@/lib/contracts/signers";

function signer(partial: Partial<ContractSigner> & { id: string; signerName: string }): ContractSigner {
  return {
    contractId: "c1",
    venueId: "v1",
    signerType: "client",
    signerRole: null,
    signerRefId: null,
    clientContactId: null,
    signerEmail: null,
    isRequired: true,
    signOrder: 0,
    signToken: `tok-${partial.id}`,
    signedAt: null,
    signerIp: null,
    signerUserAgent: null,
    consentConfirmed: null,
    consentText: null,
    contentHash: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

const nicole = signer({
  id: "sig-nicole",
  signerName: "Nicole Bethune",
  signerEmail: "jyagnesak@yahoo.com",
  signerRole: "primary",
  signOrder: 0,
});
const colby = signer({
  id: "sig-colby",
  signerName: "Colby Yagnesak",
  signerEmail: "colby.yagnesak@example.com",
  signerRole: "partner",
  signOrder: 1,
});
const venue = signer({
  id: "sig-venue",
  signerName: "Venue Owner",
  signerType: "venue",
  isRequired: true,
  signerEmail: "owner@venue.test",
});

describe("listResendRecipients", () => {
  it("1. displays both required client signatories (not venue)", () => {
    const list = listResendRecipients([venue, colby, nicole]);
    assert.equal(list.length, 2);
    assert.equal(list[0]!.name, "Nicole Bethune");
    assert.equal(list[0]!.email, "jyagnesak@yahoo.com");
    assert.equal(list[0]!.roleLabel, "Primary");
    assert.equal(list[1]!.name, "Colby Yagnesak");
    assert.equal(list[1]!.email, "colby.yagnesak@example.com");
    assert.equal(list[1]!.roleLabel, "Partner");
  });

  it("2. both are selected by default", () => {
    const list = listResendRecipients([nicole, colby]);
    assert.deepEqual(defaultResendSelection(list), ["sig-nicole", "sig-colby"]);
  });

  it("13. single-signatory contracts still list one recipient", () => {
    const list = listResendRecipients([nicole]);
    assert.equal(list.length, 1);
    assert.deepEqual(defaultResendSelection(list), ["sig-nicole"]);
  });
});

describe("validateResendSelection", () => {
  it("3/4/5. selection subsets are accepted", () => {
    assert.deepEqual(
      validateResendSelection([nicole, colby], ["sig-nicole"]),
      { ok: true, signerIds: ["sig-nicole"] },
    );
    assert.deepEqual(
      validateResendSelection([nicole, colby], ["sig-colby"]),
      { ok: true, signerIds: ["sig-colby"] },
    );
    assert.deepEqual(
      validateResendSelection([nicole, colby], ["sig-nicole", "sig-colby"]),
      { ok: true, signerIds: ["sig-nicole", "sig-colby"] },
    );
  });

  it("6. empty selection is rejected", () => {
    const r = validateResendSelection([nicole, colby], []);
    assert.equal(r.ok, false);
  });

  it("7. rejects a signer id from another contract", () => {
    const r = validateResendSelection([nicole, colby], ["sig-other-contract"]);
    assert.equal(r.ok, false);
    assert.match((r as { message: string }).message, /not authorized/i);
  });

  it("8. rejects arbitrary email addresses", () => {
    const r = validateResendSelection([nicole, colby], ["attacker@evil.test"]);
    assert.equal(r.ok, false);
    assert.match((r as { message: string }).message, /signator/i);
  });

  it("dedupes repeated ids so each recipient is sent once", () => {
    const r = validateResendSelection([nicole, colby], ["sig-nicole", "sig-nicole", "sig-colby"]);
    assert.deepEqual(r, { ok: true, signerIds: ["sig-nicole", "sig-colby"] });
  });
});

describe("summarizeResendDeliveries", () => {
  it("12. partial delivery failure is reported accurately", () => {
    const summary = summarizeResendDeliveries([
      {
        signerId: "sig-nicole",
        name: "Nicole Bethune",
        email: "jyagnesak@yahoo.com",
        status: "accepted",
      },
      {
        signerId: "sig-colby",
        name: "Colby Yagnesak",
        email: "colby@example.com",
        status: "failed",
        message: "provider rejected",
      },
    ]);
    assert.equal(summary.ok, true);
    assert.match(summary.message, /Nicole Bethune/);
    assert.match(summary.message, /Colby Yagnesak/);
    assert.match(summary.message, /provider rejected/);
  });

  it("all-failed does not claim success", () => {
    const summary = summarizeResendDeliveries([
      {
        signerId: "sig-nicole",
        name: "Nicole Bethune",
        email: "a@b.c",
        status: "failed",
        message: "quota",
      },
    ]);
    assert.equal(summary.ok, false);
  });
});

describe("wiring — UI and server enforce selection", () => {
  it("contract detail uses ContractResendDialog with signer ids", () => {
    const detail = readFileSync(resolve("components/contracts/contract-detail.tsx"), "utf8");
    assert.match(detail, /ContractResendDialog/);
    assert.match(detail, /resendContractAction\(contract\.id, message, signerIds\)/);
    assert.doesNotMatch(
      detail.slice(detail.indexOf('contract.status === "sent"'), detail.indexOf('contract.status === "sent"') + 500),
      /ShareDialog/,
    );
  });

  it("resendContract validates selection and does not rewrite content", () => {
    const service = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
    const start = service.indexOf("export async function resendContract");
    const end = service.indexOf("export async function cancelContract");
    const fn = service.slice(start, end);
    assert.match(fn, /validateResendSelection/);
    assert.match(fn, /validated\.signerIds/);
    assert.match(fn, /contentHashUnchanged/);
    assert.match(fn, /beforeContent/);
    assert.doesNotMatch(fn, /updateContractContent|insertContract\(/);
  });

  it("dialog disables Resend with nobody selected", () => {
    const dialog = readFileSync(resolve("components/contracts/contract-resend-dialog.tsx"), "utf8");
    assert.match(dialog, /selected\.length > 0/);
    assert.match(dialog, /Select at least one recipient/);
    assert.match(dialog, /Choose who should receive another copy of their signing link/);
  });
});
