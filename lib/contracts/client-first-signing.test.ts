/**
 * Client-first contract signing — progressive status, send, venue countersign.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  anyClientHasSigned,
  deriveContractSigningUiState,
} from "@/lib/contracts/signers";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("client-picker fix does not regress client-first signing", () => {
  it("still derives client-first states from required client signers", () => {
    const sent = deriveContractSigningUiState({
      status: "sent", venueSigned: false, requiredClientTotal: 2, requiredClientSigned: 0, expiresAt: null,
    });
    assert.equal(sent.state, "sent_to_client");
    const awaiting = deriveContractSigningUiState({
      status: "sent", venueSigned: false, requiredClientTotal: 2, requiredClientSigned: 2, expiresAt: null,
    });
    assert.equal(awaiting.state, "awaiting_venue_signature");
  });
});

describe("progressive human-facing contract status (client-first)", () => {
  it("Draft before send", () => {
    const r = deriveContractSigningUiState({
      status: "draft", venueSigned: false, requiredClientTotal: 1, requiredClientSigned: 0, expiresAt: null,
    });
    assert.equal(r.state, "draft");
    assert.equal(r.label, "Draft");
  });

  it("Sent to Client after issue, before client signs", () => {
    const r = deriveContractSigningUiState({
      status: "sent", venueSigned: false, requiredClientTotal: 1, requiredClientSigned: 0, expiresAt: null,
    });
    assert.equal(r.state, "sent_to_client");
    assert.equal(r.label, "Sent to Client");
  });

  it("Awaiting Venue Signature after client signs", () => {
    const r = deriveContractSigningUiState({
      status: "sent", venueSigned: false, requiredClientTotal: 1, requiredClientSigned: 1, expiresAt: null,
    });
    assert.equal(r.state, "awaiting_venue_signature");
    assert.equal(r.label, "Awaiting Venue Signature");
  });

  it("partial multi-signer stays Sent to Client with count", () => {
    const r = deriveContractSigningUiState({
      status: "sent", venueSigned: false, requiredClientTotal: 2, requiredClientSigned: 1, expiresAt: null,
    });
    assert.equal(r.state, "sent_to_client");
    assert.equal(r.label, "Sent to Client (1 of 2)");
    assert.doesNotMatch(r.label, /Fully Executed/i);
  });

  it("Fully Executed only when status is signed", () => {
    const r = deriveContractSigningUiState({
      status: "signed", venueSigned: true, requiredClientTotal: 2, requiredClientSigned: 2, expiresAt: null,
    });
    assert.equal(r.state, "fully_signed");
    assert.equal(r.label, "Fully Executed");
  });

  it("list and badge use client-first progressive labels", () => {
    const list = read("components/contracts/contract-list.tsx");
    const badge = read("components/contracts/contract-status-badge.tsx");
    assert.match(list, /Sent to Client/);
    assert.match(list, /Awaiting Venue Signature/);
    assert.match(list, /Fully Executed/);
    assert.doesNotMatch(list, /Ready to send/);
    assert.match(badge, /deriveContractSigningUiState/);
  });

  it("detail primary path is send-to-client then venue countersign", () => {
    const detail = read("components/contracts/contract-detail.tsx");
    assert.match(detail, /Send to Client/);
    assert.match(detail, /awaitingVenueSignature/);
    assert.doesNotMatch(detail, /Ready to send — release/);
    assert.doesNotMatch(detail, /venue must sign this contract before it can be released/i);
  });
});

describe("client-first gates in source", () => {
  it("sendContract does not require venue signature first", () => {
    const service = read("lib/contracts/service.ts");
    assert.doesNotMatch(service, /venue must sign this contract before it can be released/);
    assert.match(service, /Contract sent to client for review/);
  });

  it("venue sign requires sent + client signatures and marks fully executed", () => {
    const repo = read("lib/contracts/repository.ts");
    assert.match(repo, /All required client signatures must be complete before the venue can sign/);
    assert.match(repo, /status: "signed"/);
    assert.match(repo, /Contract fully executed/);
  });

  it("migration flips RPC and immutability to client-first", () => {
    const sql = read("supabase/migrations/20261401800000_contracts_client_first_signing.sql");
    assert.match(sql, /do NOT require venue signed_at before client can sign/i);
    assert.match(sql, /content is immutable after a client has signed/);
    assert.match(sql, /awaiting_venue/);
    assert.doesNotMatch(sql, /status = 'signed',\s*\n\s*signed_at = now/);
  });

  it("help article is client-first Exact copy", () => {
    const articles = read("lib/help-guides/final-articles.ts");
    assert.match(articles, /How Does Contract Signing Work\?/);
    assert.match(articles, /client-first signing process/);
    assert.match(articles, /Create → Send to Client → Client Reviews → Client Signs → Venue Signs → Fully Executed/);
    assert.doesNotMatch(articles, /venue-first signing process/);
    assert.doesNotMatch(articles, /Create → Venue signs → Release → Client signs/);
  });
});

describe("anyClientHasSigned", () => {
  it("detects client signatures", () => {
    assert.equal(anyClientHasSigned([
      { signerType: "venue", signedAt: null, isRequired: true },
      { signerType: "client", signedAt: "2026-01-01", isRequired: true },
    ]), true);
    assert.equal(anyClientHasSigned([
      { signerType: "client", signedAt: null, isRequired: true },
    ]), false);
  });
});
