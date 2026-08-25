/**
 * Per-required-signer signature blocks for contract body text.
 * Client party wording ({{client_name}}) may still name the couple together;
 * the SIGNATURES section must name each required signer individually.
 */

const SIGNATURE_LINE = "Signature: ________________________________";
const DATE_LINE = "Date: ____________________________________";

/** One Client signature block for a named required signer. */
export function renderClientSignatureBlock(signerName: string): string {
  const name = signerName.trim();
  return ["Client", name, "", SIGNATURE_LINE, DATE_LINE].join("\n");
}

export function renderClientSignatureBlocks(signerNames: string[]): string {
  return signerNames.map((n) => n.trim()).filter(Boolean).map(renderClientSignatureBlock).join("\n\n");
}

/** Matches a single Client / name / Signature / Date block (starter + merged copies). */
const SINGLE_CLIENT_SIGNATURE_BLOCK =
  /Client\n[^\n]+\n\nSignature: _{8,}\nDate: _{8,}/;

const CLIENT_SIGNATURE_BLOCK_GLOBAL = new RegExp(SINGLE_CLIENT_SIGNATURE_BLOCK.source, "g");

/**
 * Ensure the contract body has one Client signature block per required signer.
 * Does not rewrite an already-expanded multi-block SIGNATURES section.
 * Existing sent/signed contracts are never passed through this at rest —
 * only new drafts (and live/template previews).
 */
export function applyRequiredSignerSignatureBlocks(
  content: string,
  requiredClientNames: string[],
): string {
  const names = requiredClientNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return content;

  const blocks = renderClientSignatureBlocks(names);

  if (content.includes("{{client_signature_blocks}}")) {
    return content.replaceAll("{{client_signature_blocks}}", blocks);
  }

  const existing = content.match(CLIENT_SIGNATURE_BLOCK_GLOBAL) ?? [];
  if (existing.length === 1) {
    return content.replace(SINGLE_CLIENT_SIGNATURE_BLOCK, blocks);
  }

  return content;
}

export type ClientSigningParty = {
  id: string;
  name: string;
  signedAt: string | null;
  contentHash: string | null;
};

/**
 * Pure lifecycle helper — one client signing event cannot complete another
 * signer's requirement. Used by tests; the database RPC is the system of record.
 */
export function recordRequiredClientSignature(
  parties: ClientSigningParty[],
  actingSignerId: string,
  opts: { signedAt: string; contentHash: string },
): {
  parties: ClientSigningParty[];
  fullyExecuted: boolean;
  hashMismatch: boolean;
} {
  const acting = parties.find((p) => p.id === actingSignerId);
  if (!acting || acting.signedAt) {
    return { parties, fullyExecuted: false, hashMismatch: false };
  }

  const next = parties.map((p) =>
    p.id === actingSignerId
      ? { ...p, signedAt: opts.signedAt, contentHash: opts.contentHash }
      : p,
  );

  const allSigned = next.every((p) => p.signedAt);
  const hashes = next.map((p) => p.contentHash).filter((h): h is string => Boolean(h));
  const hashMismatch = allSigned && new Set(hashes).size > 1;
  return {
    parties: next,
    fullyExecuted: allSigned && !hashMismatch,
    hashMismatch,
  };
}

export function canReopenContractForEditing(opts: {
  status: string;
  clientSigners: { signedAt: string | null }[];
}): { ok: true } | { ok: false; message: string } {
  if (opts.status !== "sent") {
    return { ok: false, message: "Only a sent contract can be reopened for editing." };
  }
  if (opts.clientSigners.some((s) => s.signedAt)) {
    return {
      ok: false,
      message:
        "This contract already has a client signature. Reopening would change the agreement after someone has signed. Cancel and start a new contract, or create an amendment once this one is fully executed and finalized.",
    };
  }
  return { ok: true };
}
