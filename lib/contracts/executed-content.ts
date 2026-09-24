/**
 * Customer-facing Fully Executed contract body — render-time fill only.
 * Stored content + content hashes remain unchanged.
 */
import {
  fillCompletedSignatureBlocks,
  type SignatureEvidence,
} from "@/lib/contracts/signature-blocks";

export function renderExecutedContractContent(
  content: string,
  signers: SignatureEvidence[],
  opts?: { status?: string },
): string {
  if (opts?.status && opts.status !== "signed") return content;
  if (!signers.some((s) => s.signedAt)) return content;
  return fillCompletedSignatureBlocks(content, signers);
}
