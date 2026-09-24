/**
 * Fully Executed contract body — fill signature blanks at render time only.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fillCompletedSignatureBlocks } from "@/lib/contracts/signature-blocks";
import { renderExecutedContractContent } from "@/lib/contracts/executed-content";

const BLANK_BODY = `Agreement terms here.

────────────────────────────────
SIGNATURES
────────────────────────────────
Client
Alex Client

Signature: ________________________________
Date: ____________________________________

Venue
Garden Hall

Authorized Representative: ________________
Signature: ________________________________
Date: January 1, 2026
`;

describe("fillCompletedSignatureBlocks", () => {
  it("fills client and venue blanks from contract_signers evidence", () => {
    const filled = fillCompletedSignatureBlocks(BLANK_BODY, [
      {
        signerType: "client",
        signerName: "Alex Client",
        signedAt: "2026-02-10T15:00:00.000Z",
        isRequired: true,
      },
      {
        signerType: "venue",
        signerName: "Pat Venue",
        signedAt: "2026-02-11T12:00:00.000Z",
      },
    ]);
    assert.match(filled, /Signature: Alex Client \(electronically signed\)/);
    assert.match(filled, /Date: February 10, 2026/);
    assert.match(filled, /Authorized Representative: Pat Venue/);
    assert.match(filled, /Signature: Pat Venue \(electronically signed\)/);
    assert.match(filled, /Date: February 11, 2026/);
    assert.doesNotMatch(filled, /Signature: _{8,}/);
  });

  it("leaves blanks when unsigned", () => {
    const filled = fillCompletedSignatureBlocks(BLANK_BODY, [
      { signerType: "client", signerName: "Alex Client", signedAt: null, isRequired: true },
    ]);
    assert.match(filled, /Signature: _{8,}/);
  });

  it("renderExecutedContractContent only fills when status is signed", () => {
    const signers = [
      {
        signerType: "client" as const,
        signerName: "Alex Client",
        signedAt: "2026-02-10T15:00:00.000Z",
        isRequired: true,
      },
    ];
    assert.equal(
      renderExecutedContractContent(BLANK_BODY, signers, { status: "sent" }),
      BLANK_BODY,
    );
    assert.match(
      renderExecutedContractContent(BLANK_BODY, signers, { status: "signed" }),
      /electronically signed/,
    );
  });
});
