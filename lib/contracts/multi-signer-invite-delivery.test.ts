import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Two required client signers must each receive their own invite to their own
 * email with their own signing URL. Signer-row existence is not delivery.
 */
describe("multi-signer contract invite delivery", () => {
  const service = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
  const invite = service.slice(
    service.indexOf("async function sendContractInviteEmails"),
    service.indexOf("export async function venueSignContract"),
  );

  it("loops every required client signer and does not stop after the first", () => {
    assert.match(invite, /filter\(\(s\) => s\.signerType === "client" && s\.isRequired\)/);
    assert.match(invite, /for \(const signer of clientSigners\)/);
    assert.match(invite, /sendEmail\(\{[\s\S]*to: signer\.signerEmail/);
    assert.match(invite, /sign\/\$\{signer\.signToken\}/);
    // Must not collapse to a single client.email send when signers exist.
    const clientSignerBlock = invite.slice(
      invite.indexOf("if (clientSigners.length > 0)"),
      invite.indexOf("// Legacy fallback"),
    );
    assert.doesNotMatch(clientSignerBlock, /client\.email/);
    assert.doesNotMatch(clientSignerBlock, /break;/);
    assert.doesNotMatch(clientSignerBlock, /return;\s*\n\s*const result = await sendEmail/);
  });

  it("records an outbound invite per successful send, keyed to the contract", () => {
    assert.match(invite, /sourceType: "contract_invite"/);
    assert.match(invite, /sourceId: contract\.id/);
    assert.match(invite, /providerId: result\.method === "resend" \? result\.providerId/);
    // Per-signer loop body includes both send and record — not record-once outside the loop.
    const loopBody = invite.slice(
      invite.indexOf("for (const signer of clientSigners)"),
      invite.indexOf("return;", invite.indexOf("for (const signer of clientSigners)")),
    );
    assert.match(loopBody, /sendEmail/);
    assert.match(loopBody, /recordExternalClientOutbound/);
  });

  it("sendContract and resendContract both use the shared multi-signer invite path", () => {
    const send = service.slice(service.indexOf("export async function sendContract"));
    const resend = service.slice(service.indexOf("export async function resendContract"));
    assert.match(send, /sendContractInviteEmails\(refreshed \?\? contract/);
    assert.match(resend, /sendContractInviteEmails\(contract/);
  });

  it("two distinct required client emails imply two distinct invite targets in the send helper", () => {
    // Guard the product rule in code form: each signer's email and token are
    // read inside the loop, so two signers cannot share one send call.
    const loopBody = invite.slice(
      invite.indexOf("for (const signer of clientSigners)"),
      invite.indexOf("// Legacy fallback"),
    );
    assert.match(loopBody, /to: signer\.signerEmail/);
    assert.match(loopBody, /signer\.signToken/);
    assert.match(loopBody, /signer\.signerName/);
    const sendEmailCalls = loopBody.match(/await sendEmail\(/g) ?? [];
    assert.equal(sendEmailCalls.length, 1, "exactly one sendEmail call site inside the per-signer loop");
  });
});
