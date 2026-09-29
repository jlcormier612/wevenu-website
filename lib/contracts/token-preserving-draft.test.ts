import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("token-preserving contract draft", () => {
  const service = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
  const builder = readFileSync(resolve("components/contracts/contract-builder.tsx"), "utf8");
  const detail = readFileSync(resolve("components/contracts/contract-detail.tsx"), "utf8");

  it("createContract stores authored content and does not resolve tokens", () => {
    const create = service.slice(service.indexOf("export async function createContract"));
    assert.match(create, /Token-preserving draft/);
    assert.match(create, /content: resolvedInput\.content/);
    assert.doesNotMatch(
      create.slice(0, create.indexOf("export async function materializeAuthoredContractContent")),
      /leftover\.length/,
    );
    assert.doesNotMatch(
      create.slice(0, create.indexOf("export async function materializeAuthoredContractContent")),
      /mergeContent\(resolvedInput\.content/,
    );
  });

  it("sendContract is the only persist path that materializes tokens", () => {
    const send = service.slice(service.indexOf("export async function sendContract"));
    assert.match(send, /materializeAuthoredContractContent/);
    assert.match(send, /assertCustomerSafeContractContent\(materialized\.content/);
    assert.match(send, /forceResolveContractContent/);
    assert.match(send, /publishContractDocument\(supabase, customerFacing\)/);
  });

  it("Preview, Review, and Send share materializeAuthoredContractContent", () => {
    const preview = service.slice(service.indexOf("export async function previewContractContent"));
    const send = service.slice(service.indexOf("export async function sendContract"));
    const builder = readFileSync(resolve("components/contracts/contract-builder.tsx"), "utf8");
    assert.match(preview, /materializeAuthoredContractContent/);
    assert.match(send, /materializeAuthoredContractContent/);
    assert.match(builder, /resolvePreview\(\)/);
    assert.match(builder, /handleReviewAndSend/);
    assert.match(builder, /setPreviewContent\(resolved\)/);
  });

  it("Send reconstructs signer ids from persisted rows, not client_contact_id only", () => {
    const send = service.slice(service.indexOf("export async function sendContract"));
    assert.match(send, /resolveSignerSelectionIdsFromContract/);
    assert.doesNotMatch(send, /s\.clientContactId as string/);
    assert.match(service, /selectedIdsFromExistingSigners/);
  });

  it("preview is display-only and never writes authored content", () => {
    assert.match(builder, /previewContractContentAction/);
    assert.doesNotMatch(builder, /setContent\(result\.content\)/);
    assert.doesNotMatch(builder, /setContent\(resolved\)/);
    assert.match(builder, /Preview — display only/);
    assert.match(builder, /insertSmartField/);
    assert.match(builder, /MERGE_FIELDS/);
  });

  it("draft reopen uses the same Contract Builder, not the reduced textarea", () => {
    assert.match(detail, /mode="draft"/);
    assert.match(detail, /<ContractBuilder/);
    const draftBlock = detail.slice(detail.indexOf("contract.status === \"draft\" && ("));
    assert.match(draftBlock, /ContractBuilder/);
    assert.doesNotMatch(
      detail.slice(detail.indexOf("{contract.status !== \"draft\" && editing")),
      /mode="draft"/,
    );
  });

  it("Back to edit stays on the full builder overlay", () => {
    const overlay = readFileSync(resolve("components/artifacts/artifact-review-overlay.tsx"), "utf8");
    assert.match(overlay, /Back to edit/);
    assert.match(builder, /onBack=\{closePreview\}/);
    assert.match(builder, /Save draft/);
  });

  it("new contracts can Review & send without a prior manual Save draft", () => {
    assert.match(builder, /mode === "create"/);
    assert.match(builder, /Review &amp; send to client/);
    assert.match(builder, /persistedContractId/);
    const createReview = builder.slice(
      builder.indexOf("function handleReviewAndSend"),
      builder.indexOf("function handleSend"),
    );
    assert.match(createReview, /mode === "create"/);
    assert.match(createReview, /resolvePreview\(\)/);
    assert.doesNotMatch(
      createReview.slice(createReview.indexOf('if (mode === "create")'), createReview.indexOf("if (!draft)")),
      /createContractAction|updateContractContentAction/,
    );
    const send = builder.slice(builder.indexOf("function handleSend"));
    assert.match(send, /createContractAction/);
    assert.match(send, /sendContractAction/);
    assert.match(send, /setPersistedContractId/);
    assert.match(send, /STARTER_POLICY_PLACEHOLDERS/);
  });

  it("create-mode Send reuses sendContract after create and does not resolve tokens on insert", () => {
    const create = service.slice(service.indexOf("export async function createContract"));
    assert.doesNotMatch(
      create.slice(0, create.indexOf("export async function materializeAuthoredContractContent")),
      /mergeContent\(resolvedInput\.content/,
    );
    assert.match(builder, /createContractAction\([\s\S]*?sendContractAction/);
  });
});
