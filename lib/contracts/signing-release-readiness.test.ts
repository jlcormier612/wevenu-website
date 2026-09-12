/**
 * Contracts / Signing release-readiness — focused coverage for approved
 * progressive status, Clone & Resend, immutability, event auto-link,
 * draft-token protection, and commercial continuity seams.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  anyClientHasSigned,
  deriveContractSigningUiState,
} from "@/lib/contracts/signers";
import {
  canCloneAndResendContract,
  canReopenContractForEditing,
  projectCloneDraftFromSource,
  type CloneSourceSnapshot,
} from "@/lib/contracts/signature-blocks";
import { isCommerciallyBooked } from "@/lib/booking-journey/model";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("progressive human-facing contract status", () => {
  it("Draft before venue signature", () => {
    const r = deriveContractSigningUiState({
      status: "draft", venueSigned: false, requiredClientTotal: 1, requiredClientSigned: 0, expiresAt: null,
    });
    assert.equal(r.state, "draft");
    assert.equal(r.label, "Draft");
  });

  it("Ready to send after venue signature, before release", () => {
    const r = deriveContractSigningUiState({
      status: "draft", venueSigned: true, requiredClientTotal: 1, requiredClientSigned: 0, expiresAt: null,
    });
    assert.equal(r.state, "ready_to_send");
    assert.equal(r.label, "Ready to send");
  });

  it("Awaiting client signature after release", () => {
    const r = deriveContractSigningUiState({
      status: "sent", venueSigned: true, requiredClientTotal: 1, requiredClientSigned: 0, expiresAt: null,
    });
    assert.equal(r.state, "awaiting_client_signature");
    assert.equal(r.label, "Awaiting client signature");
  });

  it("partial multi-signer shows honest count, not Fully signed", () => {
    const r = deriveContractSigningUiState({
      status: "sent", venueSigned: true, requiredClientTotal: 2, requiredClientSigned: 1, expiresAt: null,
    });
    assert.equal(r.state, "awaiting_client_signature");
    assert.equal(r.label, "Awaiting client signature (1 of 2)");
    assert.doesNotMatch(r.label, /Fully signed/i);
  });

  it("Fully signed only when status is signed", () => {
    const r = deriveContractSigningUiState({
      status: "signed", venueSigned: true, requiredClientTotal: 2, requiredClientSigned: 2, expiresAt: null,
    });
    assert.equal(r.state, "fully_signed");
    assert.equal(r.label, "Fully signed");
  });

  it("list and badge use progressive labels, not Sent/Signed jargon", () => {
    const list = read("components/contracts/contract-list.tsx");
    const badge = read("components/contracts/contract-status-badge.tsx");
    assert.match(list, /Ready to send/);
    assert.match(list, /Awaiting client signature/);
    assert.match(list, /Fully signed/);
    assert.match(badge, /deriveContractSigningUiState/);
    assert.doesNotMatch(badge, /STATUS_LABEL/);
  });
});

describe("partial-sign notification language", () => {
  it("migration uses A client signed the contract for partial, Contract fully signed for complete", () => {
    const sql = read("supabase/migrations/20261355000000_contracts_signing_integrity.sql");
    assert.match(sql, /'A client signed the contract'/);
    assert.match(sql, /'Contract fully signed'/);
    // Must not fire the old fully-implying title on the per-signer path
    const partialBlock = sql.slice(
      sql.indexOf("Honest partial-sign"),
      sql.indexOf("Fully executed when every"),
    );
    assert.match(partialBlock, /A client signed the contract/);
    assert.doesNotMatch(partialBlock, /'Contract signed'/);
  });

  it("settings preference label matches partial-sign honesty", () => {
    const ui = read("components/settings/notification-preferences-section.tsx");
    assert.match(ui, /A client signed the contract/);
  });
});

describe("event auto-linking on create", () => {
  it("createContract looks up dated event when client known and eventId empty", () => {
    const svc = read("lib/contracts/service.ts");
    const create = svc.slice(svc.indexOf("export async function createContract"));
    assert.match(create, /Contextual Event auto-link/);
    assert.match(create, /\.not\("event_date", "is", null\)/);
    assert.match(create, /eq\("client_id", input\.clientId\)/);
  });

  it("does not universally require eventId in NewContractInput validation", () => {
    const validation = read("lib/contracts/validation.ts");
    assert.doesNotMatch(validation, /eventId.*required/i);
  });
});

describe("signed-contract immutability + Clone & Resend", () => {
  it("reopen rejects after venue signature (released, no client signed yet)", () => {
    const repo = read("lib/contracts/repository.ts");
    const start = repo.indexOf("export async function reopenForEditing");
    const end = repo.indexOf("export async function updateContractStatus", start);
    const reopen = repo.slice(start, end);
    assert.match(reopen, /cannot be reopened for editing after the venue has signed/);
    assert.match(reopen, /Content is immutable — use Create New Version/);
    assert.doesNotMatch(reopen, /status: "draft"/);
    assert.doesNotMatch(reopen, /signed_at: null/);
    assert.equal(
      canReopenContractForEditing({
        status: "sent",
        venueSigned: true,
        clientSigners: [{ signedAt: null }, { signedAt: null }],
      }).ok,
      false,
    );
  });

  it("reopen rejects when any client has signed", () => {
    const repo = read("lib/contracts/repository.ts");
    assert.match(repo, /A client has already signed this contract\. Use Create New Version/);
    assert.equal(
      canReopenContractForEditing({
        status: "sent",
        venueSigned: true,
        clientSigners: [{ signedAt: "2026-01-02" }, { signedAt: null }],
      }).ok,
      false,
    );
  });

  it("anyClientHasSigned helper is true after one client signature", () => {
    assert.equal(
      anyClientHasSigned([
        { signerType: "venue", signedAt: "2026-01-01", isRequired: true },
        { signerType: "client", signedAt: "2026-01-02", isRequired: true },
      ]),
      true,
    );
    assert.equal(
      anyClientHasSigned([
        { signerType: "venue", signedAt: "2026-01-01", isRequired: true },
        { signerType: "client", signedAt: null, isRequired: true },
      ]),
      false,
    );
  });

  it("cloneAndResendContract creates new draft without copying signatures/tokens", () => {
    const svc = read("lib/contracts/service.ts");
    const clone = svc.slice(svc.indexOf("export async function cloneAndResendContract"));
    assert.match(clone, /insertContractSigners/);
    assert.match(clone, /amendsContractId: sourceContractId/);
    assert.match(clone, /New version of/);
    assert.match(clone, /content: source\.content/);
    assert.match(clone, /clientId: source\.clientId/);
    assert.match(clone, /eventId: source\.eventId/);
    assert.match(clone, /venueSigned/);
    assert.doesNotMatch(clone, /signedAt:/);
    assert.doesNotMatch(clone, /signToken:/);
  });

  it("Create New Version is available after venue signature even with zero client signatures", () => {
    assert.equal(
      canCloneAndResendContract({
        venueSigned: true,
        status: "sent",
        anyClientSigned: false,
      }).ok,
      true,
    );
    assert.equal(
      canCloneAndResendContract({
        venueSigned: false,
        status: "draft",
        anyClientSigned: false,
      }).ok,
      false,
    );
  });

  it("partially signed Clone & Resend keeps original signatures and yields a fresh draft", () => {
    // Two required clients; one has signed; venue uses Clone & Resend.
    const original: CloneSourceSnapshot = {
      id: "contract-orig",
      status: "sent",
      title: "Reception Agreement",
      content: "Terms A — do not alter on original",
      clientId: "client-1",
      eventId: "event-1",
      templateId: "tmpl-1",
      executionOrigin: "htc",
      finalizedAt: null,
      sentAt: "2026-03-01T12:00:00.000Z",
      signers: [
        {
          id: "sig-venue",
          signerType: "venue",
          isRequired: true,
          signedAt: "2026-02-28T10:00:00.000Z",
          signToken: "tok-venue-orig",
          contentHash: "hash-venue",
          consentText: "I agree…",
          signerIp: "1.1.1.1",
        },
        {
          id: "sig-client-a",
          signerType: "client",
          isRequired: true,
          signedAt: "2026-03-02T09:00:00.000Z",
          signToken: "tok-client-a",
          contentHash: "hash-a",
          consentText: "I agree…",
          signerIp: "2.2.2.2",
        },
        {
          id: "sig-client-b",
          signerType: "client",
          isRequired: true,
          signedAt: null,
          signToken: "tok-client-b",
          contentHash: null,
          consentText: null,
          signerIp: null,
        },
      ],
    };

    assert.equal(
      canCloneAndResendContract({
        venueSigned: true,
        status: original.status,
        anyClientSigned: true,
      }).ok,
      true,
    );
    assert.equal(canReopenContractForEditing({
      status: "sent",
      venueSigned: true,
      clientSigners: original.signers.filter((s) => s.signerType === "client"),
    }).ok, false);

    const before = structuredClone(original);
    const { originalUnchanged, clone } = projectCloneDraftFromSource(original);

    // Original remains unchanged (including existing client signature + evidence).
    assert.deepEqual(originalUnchanged, before);
    assert.equal(originalUnchanged.signers[1].signedAt, "2026-03-02T09:00:00.000Z");
    assert.equal(originalUnchanged.signers[1].signToken, "tok-client-a");
    assert.equal(originalUnchanged.signers[1].contentHash, "hash-a");
    assert.equal(originalUnchanged.signers[1].signerIp, "2.2.2.2");
    assert.equal(originalUnchanged.status, "sent");
    assert.equal(originalUnchanged.sentAt, "2026-03-01T12:00:00.000Z");

    // Clone is a new Draft with preserved association/content, no execution state.
    assert.equal(clone.status, "draft");
    assert.equal(clone.title, original.title);
    assert.equal(clone.content, original.content);
    assert.equal(clone.clientId, original.clientId);
    assert.equal(clone.eventId, original.eventId);
    assert.equal(clone.amendsContractId, original.id);
    assert.equal(clone.finalizedAt, null);
    assert.equal(clone.sentAt, null);

    // Fresh signer rows: zero signed_at; tokens/evidence not inherited.
    assert.equal(clone.signers.length, 3); // venue + 2 required clients
    assert.ok(clone.signers.every((s) => s.signedAt === null));
    assert.ok(clone.signers.every((s) => s.inheritsToken === false));
    assert.ok(clone.signers.every((s) => s.inheritsEvidence === false));
  });

  it("detail UI offers Create New Version after venue signature; reopen is never offered", () => {
    const detail = read("components/contracts/contract-detail.tsx");
    assert.match(detail, /Create New Version/);
    assert.match(detail, /canCreateNewVersion/);
    assert.match(detail, /const canReopen = false/);
    assert.match(detail, /venueSigned \|\| clientSigned/);
    assert.match(detail, /createNewVersionFromContractAction/);
    assert.doesNotMatch(detail, /Clone &amp; Resend|Clone & Resend/);
    assert.doesNotMatch(detail, /Create Amendment/);
  });

  it("content edit remains gated after venue signature in repository", () => {
    const repo = read("lib/contracts/repository.ts");
    assert.match(repo, /signed by the venue and can no longer be edited/);
    assert.match(repo, /Use Create New Version/);
  });
});

describe("public draft-token RPC", () => {
  it("withholds content when status is draft", () => {
    const sql = read("supabase/migrations/20261355000000_contracts_signing_integrity.sql");
    assert.match(sql, /if v\.status = 'draft' then/);
    assert.match(sql, /v_content := null/);
    assert.match(sql, /Unreleased drafts: metadata/);
  });
});

describe("database content immutability", () => {
  it("migration adds contracts_content_immutability trigger after venue signature", () => {
    const sql = read("supabase/migrations/20261355000000_contracts_signing_integrity.sql");
    assert.match(sql, /contracts_enforce_content_immutability/);
    assert.match(sql, /immutable after the venue has signed/);
    assert.match(sql, /new\.content is not distinct from old\.content/);
  });
});

describe("RLS venue-signature withdrawal alignment", () => {
  it("contract_signers_update requires owner/manager for venue signer rows", () => {
    const sql = read("supabase/migrations/20261355000000_contracts_signing_integrity.sql");
    assert.match(sql, /drop policy if exists contract_signers_update/);
    assert.match(sql, /signer_type = 'client'/);
    assert.match(sql, /current_user_role\(\) in \('owner', 'manager'\)/);
    // Old staff-clearing escape hatch must be gone from this migration's policy
    const policy = sql.slice(sql.lastIndexOf("create policy contract_signers_update"));
    assert.doesNotMatch(policy, /or signed_at is null/);
  });

  it("app withdraw and reopen remain Owner/Manager", () => {
    const svc = read("lib/contracts/service.ts");
    assert.match(svc, /Only an Owner or Manager can withdraw the venue signature/);
    assert.match(svc, /Only an Owner or Manager can reopen a contract for editing/);
  });
});

describe("Finalize Contract remains explicit", () => {
  it("detail keeps Finalize Contract distinct from Fully signed", () => {
    const detail = read("components/contracts/contract-detail.tsx");
    assert.match(detail, /Finalize Contract/);
    assert.match(detail, /Fully signed means all required signatures/);
    assert.match(detail, /does not collect payment/);
  });
});

describe("commercial continuity", () => {
  it("fully signed contract alone is not commercially Booked without deposit", () => {
    assert.equal(
      isCommerciallyBooked({
        selection: null,
        contract: { id: "c1", status: "signed" },
        paymentLines: [{ obligationKind: "deposit", status: "pending", amount: 500 }],
      }),
      false,
    );
  });

  it("signContractByToken still calls maybeStampCommercialBookedAt only via helper", () => {
    const svc = read("lib/contracts/service.ts");
    assert.match(svc, /maybeStampCommercialBookedAt/);
    assert.doesNotMatch(svc, /booked_at:\s*new Date/);
  });
});
