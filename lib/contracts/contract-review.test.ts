import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Contract full-screen review", () => {
  const detail = readFileSync(resolve("components/contracts/contract-detail.tsx"), "utf8");
  const artifact = readFileSync(resolve("components/contracts/contract-signing-artifact.tsx"), "utf8");
  const signPage = readFileSync(resolve("app/sign/[token]/page.tsx"), "utf8");
  const signForm = readFileSync(resolve("app/sign/[token]/sign-form.tsx"), "utf8");
  const createForm = readFileSync(resolve("components/contracts/new-contract-form.tsx"), "utf8");
  const builder = readFileSync(resolve("components/contracts/contract-builder.tsx"), "utf8");

  it("venue review reuses the signing artifact, not a summary card", () => {
    assert.match(signPage, /ContractSigningArtifact/);
    assert.match(detail, /ContractSigningArtifact/);
    assert.match(artifact, /contract\.content|content/);
    assert.match(artifact, /Agreement for Review/);
    assert.doesNotMatch(artifact, /sendContractAction|signContractAction/);
  });

  it("Send for signature uses sendContractAction only after review", () => {
    assert.match(builder, /ArtifactReviewOverlay/);
    assert.match(builder, /handleSend/);
    assert.match(builder, /sendContractAction\(draft\.contractId, releaseMessage\)/);
    assert.match(builder, /Send to Client/);
    const overlay = readFileSync(resolve("components/artifacts/artifact-review-overlay.tsx"), "utf8");
    assert.match(overlay, /Back to edit/);
    assert.match(overlay, /createPortal/);
    assert.match(overlay, /z-\[200\]/);
  });

  it("opening preview cannot collect a couple signature", () => {
    assert.match(builder, /<SignForm preview/);
    assert.match(signForm, /preview \|\| !token/);
    assert.match(signForm, /disabled=\{pending \|\| preview\}/);
    assert.doesNotMatch(artifact, /signContractAction/);
  });

  it("create contract saves a draft without sending", () => {
    assert.match(builder, /router\.push\(`\/contracts\/\$\{result\.contractId\}`\)/);
    assert.doesNotMatch(builder, /review=1/);
    assert.match(createForm, /mode="create"/);
    assert.match(createForm, /ContractBuilder/);
  });
});
