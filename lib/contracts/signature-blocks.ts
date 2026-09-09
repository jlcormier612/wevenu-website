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

/**
 * Reopen-for-editing is retired once the venue has signed.
 * Content is immutable after venue signature; use Clone & Resend for revisions.
 * (Kept as an explicit guard so any leftover callers fail closed.)
 */
export function canReopenContractForEditing(opts: {
  status: string;
  venueSigned: boolean;
  clientSigners: { signedAt: string | null }[];
}): { ok: true } | { ok: false; message: string } {
  if (opts.venueSigned || opts.clientSigners.some((s) => s.signedAt)) {
    return {
      ok: false,
      message:
        "This contract cannot be reopened for editing after the venue has signed. Content is immutable — use Clone & Resend to create a new draft.",
    };
  }
  if (opts.status !== "sent") {
    return { ok: false, message: "Only a sent contract can be reopened for editing." };
  }
  return {
    ok: false,
    message:
      "This contract cannot be reopened for editing after the venue has signed. Content is immutable — use Clone & Resend to create a new draft.",
  };
}

/** Clone & Resend once venue signature locks content (including released / partial / fully signed). */
export function canCloneAndResendContract(opts: {
  venueSigned: boolean;
  status: string;
  anyClientSigned: boolean;
  executionOrigin?: string | null;
}): { ok: true } | { ok: false; message: string } {
  if (opts.executionOrigin === "external") {
    return {
      ok: false,
      message:
        "Externally executed agreements cannot be cloned for HTC e-signature. Attach a revised signed file as a document instead.",
    };
  }
  if (opts.venueSigned || opts.anyClientSigned || opts.status === "signed") {
    return { ok: true };
  }
  return {
    ok: false,
    message: "Clone & Resend is available after the venue has signed (content is then immutable).",
  };
}

/**
 * Pure projection of Clone & Resend outcomes for audit/regression tests.
 * Mirrors cloneAndResendContract: original untouched; clone is a fresh draft.
 */
export type CloneSourceSnapshot = {
  id: string;
  status: string;
  title: string;
  content: string;
  clientId: string | null;
  eventId: string | null;
  templateId: string | null;
  executionOrigin?: string | null;
  finalizedAt?: string | null;
  sentAt?: string | null;
  signers: {
    id: string;
    signerType: "venue" | "client";
    isRequired: boolean;
    signedAt: string | null;
    signToken: string;
    contentHash: string | null;
    consentText: string | null;
    signerIp: string | null;
  }[];
};

export function projectCloneDraftFromSource(source: CloneSourceSnapshot): {
  originalUnchanged: CloneSourceSnapshot;
  clone: {
    status: "draft";
    title: string;
    content: string;
    clientId: string | null;
    eventId: string | null;
    templateId: string | null;
    amendsContractId: string;
    finalizedAt: null;
    sentAt: null;
    signers: { signerType: "venue" | "client"; signedAt: null; inheritsToken: false; inheritsEvidence: false }[];
  };
} {
  const clientSigners = source.signers.filter((s) => s.signerType === "client" && s.isRequired);
  return {
    originalUnchanged: structuredClone(source),
    clone: {
      status: "draft",
      title: source.title,
      content: source.content,
      clientId: source.clientId,
      eventId: source.eventId,
      templateId: source.templateId,
      amendsContractId: source.id,
      finalizedAt: null,
      sentAt: null,
      signers: [
        { signerType: "venue", signedAt: null, inheritsToken: false, inheritsEvidence: false },
        ...clientSigners.map(() => ({
          signerType: "client" as const,
          signedAt: null as null,
          inheritsToken: false as const,
          inheritsEvidence: false as const,
        })),
      ],
    },
  };
}
