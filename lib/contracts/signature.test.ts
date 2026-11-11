/**
 * Progressive contract signing UI labels — client-first.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveContractSigningUiState } from "@/lib/contracts/signers";

describe("deriveContractSigningUiState", () => {
  it("shows Draft before send", () => {
    const r = deriveContractSigningUiState({
      status: "draft", venueSigned: false, requiredClientTotal: 1, requiredClientSigned: 0, expiresAt: null,
    });
    assert.equal(r.label, "Draft");
  });

  it("shows Sent to Client after issue", () => {
    const r = deriveContractSigningUiState({
      status: "sent", venueSigned: false, requiredClientTotal: 1, requiredClientSigned: 0, expiresAt: null,
    });
    assert.equal(r.label, "Sent to Client");
  });

  it("shows progress while multi-signer clients are incomplete", () => {
    const r = deriveContractSigningUiState({
      status: "sent", venueSigned: false, requiredClientTotal: 2, requiredClientSigned: 1, expiresAt: null,
    });
    assert.equal(r.label, "Sent to Client (1 of 2)");
  });

  it("shows Awaiting Venue Signature after clients complete", () => {
    const r = deriveContractSigningUiState({
      status: "sent", venueSigned: false, requiredClientTotal: 2, requiredClientSigned: 2, expiresAt: null,
    });
    assert.equal(r.label, "Awaiting Venue Signature");
  });

  it("shows Fully Executed when status is signed", () => {
    const r = deriveContractSigningUiState({
      status: "signed", venueSigned: true, requiredClientTotal: 2, requiredClientSigned: 2, expiresAt: null,
    });
    assert.equal(r.label, "Fully Executed");
  });
});
