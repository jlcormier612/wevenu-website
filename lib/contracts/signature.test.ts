/**
 * Progressive contract signing UI labels — client-first.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { hashContractContent } from "@/lib/contracts/content-hash";
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

  it("keeps node:crypto out of the client-imported signers module", () => {
    const signers = readFileSync(resolve("lib/contracts/signers.ts"), "utf8");
    const hash = readFileSync(resolve("lib/contracts/content-hash.ts"), "utf8");
    assert.doesNotMatch(signers, /node:crypto|from ["']crypto["']/);
    assert.match(hash, /from ["']node:crypto["']/);
    assert.match(hash, /hashContractContent/);
  });

  it("preserves SHA-256 hex hashing for contract content", () => {
    const sample = "hello contract";
    assert.equal(
      hashContractContent(sample),
      createHash("sha256").update(sample, "utf8").digest("hex"),
    );
  });
});
