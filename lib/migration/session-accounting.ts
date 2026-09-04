/**
 * Pure Migration Center completion accounting — safe for client + server.
 * Source records = imported + already in HTC + intentionally excluded
 * + needs attention + pending commit + still processing.
 */
import type { SessionSummary } from "@/lib/migration/types";

export type SessionAccounting = {
  total: number;
  imported: number;
  alreadyInHtc: number;
  intentionallyExcluded: number;
  needsAttention: number;
  pendingCommit: number;
  stillProcessing: number;
};

export function summarizeSessionAccounting(counts: SessionSummary["counts"]): SessionAccounting {
  const imported = counts.committed;
  const alreadyInHtc = counts.duplicate_exact + counts.skipped;
  const intentionallyExcluded = counts.rejected;
  const needsAttention = counts.duplicate_likely + counts.conflict + counts.needs_review;
  const pendingCommit = counts.validated + counts.approved;
  const stillProcessing = counts.parsed + counts.normalized;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    total,
    imported,
    alreadyInHtc,
    intentionallyExcluded,
    needsAttention,
    pendingCommit,
    stillProcessing,
  };
}

/** Plain-language outcome line — never implies “complete” while needsAttention > 0. */
export function formatSessionOutcomeSentence(counts: SessionSummary["counts"]): string {
  const a = summarizeSessionAccounting(counts);
  const parts: string[] = [];
  if (a.total > 0) parts.push(`${a.total} reviewed`);
  if (a.imported > 0) parts.push(`${a.imported} imported`);
  if (a.alreadyInHtc > 0) parts.push(`${a.alreadyInHtc} already in Hello to Cheers`);
  if (a.needsAttention > 0) {
    parts.push(`${a.needsAttention} need${a.needsAttention === 1 ? "s" : ""} attention`);
  }
  if (a.intentionallyExcluded > 0) {
    parts.push(`${a.intentionallyExcluded} intentionally excluded`);
  }
  if (a.pendingCommit > 0) parts.push(`${a.pendingCommit} ready to import`);
  if (a.stillProcessing > 0) parts.push(`${a.stillProcessing} still being checked`);
  if (parts.length === 0) return "Nothing recognized yet.";
  return parts.join(" · ");
}
