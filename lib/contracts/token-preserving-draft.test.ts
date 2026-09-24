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
    assert.match(send, /assertCustomerSafeContractContent\(materialized\.content\)/);
    assert.match(send, /forceResolveContractContent/);
    assert.match(send, /publishContractDocument\(supabase, customerFacing\)/);
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
});
