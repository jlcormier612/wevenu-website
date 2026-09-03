/**
 * Helpers to land a Smart Import / review proposal into Migration Center
 * as SourceRows the generic CSV adapter normalizes and commits.
 */

import type { NormalizedActiveCommitment } from "@/lib/migration/active-commitment";
import type { SourceRow } from "@/lib/migration/types";

export function activeCommitmentProposalToSourceRow(proposal: NormalizedActiveCommitment): SourceRow {
  const doc = proposal.documents?.[0];
  return {
    eventId: proposal.eventId ?? null,
    clientEmail: proposal.clientEmail ?? null,
    clientId: proposal.clientId ?? null,
    eventDate: proposal.eventDate ?? null,
    contractedTotal: proposal.contractedTotal,
    packageName: proposal.packageName ?? null,
    scheduleLinesJson: JSON.stringify(proposal.scheduleLines),
    linesJson: proposal.lines?.length ? JSON.stringify(proposal.lines) : null,
    contractTitle: proposal.contractTitle ?? null,
    contractContent: proposal.contractContent ?? null,
    contractSignedAt: proposal.contractSignedAt ?? null,
    contractSignerName: proposal.contractSignerName ?? null,
    shareSignedAgreementWithCouple: proposal.shareSignedAgreementWithCouple ? "yes" : "no",
    documentName: doc?.name ?? null,
    documentFileName: doc?.fileName ?? null,
    documentStoragePath: doc?.storagePath ?? null,
    documentStorageUrl: doc?.storageUrl ?? null,
    documentMimeType: doc?.mimeType ?? null,
    sourceId: proposal.sourceId ?? null,
  };
}
