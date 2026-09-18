/**
 * Human-facing contract version ordinals derived from amends_contract_id.
 * The lineage column remains the source of truth — version numbers are presentation only.
 */

export type ContractLineageNode = {
  id: string;
  title: string;
  status: string;
  amendsContractId: string | null;
  createdAt: string;
  signedAt: string | null;
  /** Document Domain finalized (Final PDF), when known. */
  finalized?: boolean;
  /** Venue countersignature present. */
  venueSigned?: boolean;
  /** At least one required client signature captured. */
  anyClientSigned?: boolean;
  requiredClientTotal?: number;
  requiredClientSigned?: number;
};

export type ContractVersionEntry = {
  id: string;
  versionNumber: number;
  title: string;
  status: string;
  locked: boolean;
  current: boolean;
  signedAt: string | null;
  finalized: boolean;
  createdAt: string;
  amendsContractId: string | null;
  venueSigned?: boolean;
  anyClientSigned?: boolean;
  requiredClientTotal?: number;
  requiredClientSigned?: number;
};

/** Walk parents until root; depth of this node is the version ordinal (1-based). */
export function deriveVersionNumber(
  contractId: string,
  byId: Map<string, { amendsContractId: string | null }>,
): number {
  let n = 1;
  let cursor: string | null = contractId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const node = byId.get(cursor);
    if (!node?.amendsContractId) break;
    n += 1;
    cursor = node.amendsContractId;
  }
  return n;
}

/** True when content is immutable under client-first signing (UI lock presentation). */
export function isContractContentLocked(opts: {
  status: string;
  venueSigned: boolean;
  anyClientSigned?: boolean;
}): boolean {
  if (opts.anyClientSigned) return true;
  return opts.status === "signed" || opts.status === "cancelled" || opts.status === "expired";
}

/**
 * Build ordered version family for UI history.
 * `nodes` must include every contract in the amends chain (ancestors + descendants).
 */
export function buildContractVersionFamily(
  currentId: string,
  nodes: ContractLineageNode[],
): ContractVersionEntry[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!byId.has(currentId)) return [];

  // Root = walk parents from current
  let rootId = currentId;
  const seenUp = new Set<string>();
  while (true) {
    if (seenUp.has(rootId)) break;
    seenUp.add(rootId);
    const parent = byId.get(rootId)?.amendsContractId ?? null;
    if (!parent || !byId.has(parent)) break;
    rootId = parent;
  }

  // Collect reachable descendants from root via BFS on amends edges
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.amendsContractId) continue;
    const list = children.get(n.amendsContractId) ?? [];
    list.push(n.id);
    children.set(n.amendsContractId, list);
  }

  const familyIds: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    familyIds.push(id);
    for (const child of children.get(id) ?? []) queue.push(child);
  }

  const entries = familyIds
    .map((id) => {
      const n = byId.get(id)!;
      const versionNumber = deriveVersionNumber(id, byId);
      const anyClientSigned = Boolean(n.anyClientSigned);
      const venueSigned = Boolean(n.venueSigned);
      const locked =
        n.status === "signed" ||
        n.status === "cancelled" ||
        n.status === "expired" ||
        Boolean(n.signedAt) ||
        Boolean(n.finalized) ||
        anyClientSigned ||
        venueSigned;
      return {
        id,
        versionNumber,
        title: n.title,
        status: n.status,
        locked,
        current: id === currentId,
        signedAt: n.signedAt,
        finalized: Boolean(n.finalized),
        createdAt: n.createdAt,
        amendsContractId: n.amendsContractId,
        venueSigned,
        anyClientSigned,
        requiredClientTotal: n.requiredClientTotal,
        requiredClientSigned: n.requiredClientSigned,
      } satisfies ContractVersionEntry;
    })
    .sort((a, b) => a.versionNumber - b.versionNumber || a.createdAt.localeCompare(b.createdAt));

  return entries;
}

export function formatVersionLabel(versionNumber: number): string {
  return `Version ${versionNumber}`;
}

export function statusLabelForVersion(entry: Pick<
  ContractVersionEntry,
  "status" | "finalized" | "locked" | "venueSigned" | "anyClientSigned" | "requiredClientTotal" | "requiredClientSigned"
>): string {
  if (entry.finalized) return "Fully Executed · Final";
  if (entry.status === "signed") return "Fully Executed";
  if (entry.status === "sent") {
    const total = Math.max(1, entry.requiredClientTotal ?? 1);
    const signed = entry.requiredClientSigned ?? (entry.anyClientSigned ? total : 0);
    if (signed >= total && !entry.venueSigned) return "Awaiting Venue Signature";
    if (total > 1 && signed > 0 && signed < total) {
      return `Sent to Client (${signed} of ${total})`;
    }
    return "Sent to Client";
  }
  if (entry.status === "draft") return "Draft";
  if (entry.status === "cancelled") return "Cancelled";
  if (entry.status === "expired") return "Expired";
  return entry.status;
}
