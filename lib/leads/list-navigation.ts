/**
 * Leads list URL + progressive-window helpers (pure — unit-tested).
 */

import { UNATTENDED_INQUIRY_ATTENTION } from "@/lib/luv/unattended-inquiry";
import type { LeadsListAttention, LeadsListSort } from "@/lib/leads/list-query";
import { LEADS_PAGE_SIZE } from "@/lib/leads/list-query";

export type LeadsListNavState = {
  q: string;
  status: string;
  eventType: string;
  sort: LeadsListSort;
  attention: LeadsListAttention | "all";
  outcome: "active" | "lost";
};

/** Build /leads href from committed filter state (no progressive offset in URL). */
export function buildLeadsListHref(opts: LeadsListNavState): string {
  const sp = new URLSearchParams();
  if (opts.outcome === "lost" || opts.status === "lost") {
    sp.set("view", "lost");
  } else if (opts.status !== "all") {
    sp.set("stage", opts.status);
  }
  if (opts.q.trim()) sp.set("q", opts.q.trim());
  if (opts.eventType !== "all") sp.set("eventType", opts.eventType);
  if (opts.sort !== "newest") sp.set("sort", opts.sort);
  if (opts.attention === "stale_contact") sp.set("attention", "stale_contact");
  else if (opts.attention === "open") sp.set("attention", "open");
  else if (opts.attention === "unseen") sp.set("attention", "unseen");
  else if (opts.attention === "unattended_inquiry") {
    sp.set("attention", UNATTENDED_INQUIRY_ATTENTION);
  }
  const qs = sp.toString();
  return qs ? `/leads?${qs}` : "/leads";
}

/**
 * When the committed URL query catches up, sync the draft input.
 * If the user has typed ahead of the last requested commit, keep the draft
 * so a slower navigation cannot overwrite newer keystrokes.
 */
export function nextSearchDraftFromCommitted(args: {
  draft: string;
  committedUrlQuery: string;
  lastRequestedQuery: string;
}): string {
  const { draft, committedUrlQuery, lastRequestedQuery } = args;
  if (draft !== lastRequestedQuery && draft !== committedUrlQuery) {
    return draft;
  }
  return committedUrlQuery;
}

/** Whether a debounced search navigation should fire for this draft. */
export function shouldCommitSearchDraft(args: {
  draft: string;
  committedUrlQuery: string;
  generation: number;
  currentGeneration: number;
}): boolean {
  if (args.generation !== args.currentGeneration) return false;
  return args.draft !== args.committedUrlQuery;
}

/** Append a progressive window without duplicates (by id). */
export function appendLeadWindow<T extends { id: string }>(
  existing: readonly T[],
  next: readonly T[],
): T[] {
  const seen = new Set(existing.map((l) => l.id));
  const out = [...existing];
  for (const row of next) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/**
 * After a mid-flight filter change, a pending Show-more response must be ignored.
 * Generation mismatch OR filter fingerprint mismatch → drop the append.
 */
export function shouldApplyLoadMoreResult(args: {
  requestGeneration: number;
  currentGeneration: number;
  requestFingerprint: string;
  currentFingerprint: string;
}): boolean {
  if (args.requestGeneration !== args.currentGeneration) return false;
  if (args.requestFingerprint !== args.currentFingerprint) return false;
  return true;
}

/** Stable filter fingerprint for progressive-load race checks (client + action). */
export function leadsFilterFingerprint(opts: {
  q: string;
  status: string;
  eventType: string;
  sort: string;
  attention: string;
  outcome: string;
}): string {
  return [
    opts.q,
    opts.status,
    opts.eventType,
    opts.sort,
    opts.attention,
    opts.outcome,
  ].join("|");
}

export function progressiveWindowLabel(shown: number, totalMatching: number): string {
  if (totalMatching === 0) return "Showing 0 of 0 leads";
  return `Showing ${shown} of ${totalMatching} leads`;
}

export function hasMoreLeads(shown: number, totalMatching: number): boolean {
  return shown < totalMatching;
}

export function nextProgressiveOffset(shown: number): number {
  return shown;
}

export { LEADS_PAGE_SIZE };
