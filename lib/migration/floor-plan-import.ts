/**
 * Floor Plan Phase 3 — Migration Center batch import (pure matching + heuristics).
 *
 * Scopes: space_master | event_specific | general_reference
 * High-confidence single matches are prefills only — ambiguous matches stay
 * needs_review. Never silently drops a source file.
 */

export type FloorPlanImportScope = "space_master" | "event_specific" | "general_reference";

export type NormalizedFloorPlanImport = {
  name: string;
  fileName: string;
  storagePath: string;
  storageUrl: string;
  /** Editor render URL — same as storageUrl for images; PDF page-1 derivative otherwise. */
  renderableImageUrl: string | null;
  mimeType: string | null;
  fileSize: string | null;
  scope: FloorPlanImportScope;
  spaceId: string | null;
  spaceName: string | null;
  eventId: string | null;
  eventName: string | null;
  eventDate: string | null;
  /** Stable idempotency key — usually the storage path. */
  sourceId: string | null;
  notes: string | null;
};

export type FloorPlanMatchCandidate = {
  id: string;
  name: string;
  eventDate?: string | null;
};

export type FloorPlanMatchOutcome = {
  status: "validated" | "needs_review";
  matchType: "none" | "exact" | "likely";
  matchConfidence: number | null;
  matchedEntityId: string | null;
  validationErrors: string[] | null;
  /** Prefills merged onto the normalized payload (high-confidence only). */
  patch: Partial<NormalizedFloorPlanImport>;
};

const DATE_RE = /\b(20\d{2})[-_/](\d{1,2})[-_/](\d{1,2})\b/;
const SPACE_HINT = /\b(space|room|ballroom|garden|patio|lawn|terrace|hall|loft|barn|pavilion|master)\b/i;
const EVENT_HINT = /\b(wedding|reception|ceremony|cocktail|event|booking)\b/i;

export function looseKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function displayNameFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || fileName;
}

/** Filename / path heuristics only — never invents UUIDs. */
export function proposeFloorPlanScopeFromFileName(
  fileName: string,
  spaceNames: readonly string[] = [],
): { scope: FloorPlanImportScope; spaceName: string | null; eventDate: string | null } {
  const base = displayNameFromFileName(fileName);
  const dateMatch = fileName.match(DATE_RE) ?? base.match(DATE_RE);
  const eventDate = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2]!.padStart(2, "0")}-${dateMatch[3]!.padStart(2, "0")}`
    : null;

  const key = looseKey(base);
  let spaceName: string | null = null;
  for (const name of spaceNames) {
    const sk = looseKey(name);
    if (sk.length >= 3 && key.includes(sk)) {
      spaceName = name;
      break;
    }
  }

  if (eventDate || EVENT_HINT.test(base)) {
    return { scope: "event_specific", spaceName, eventDate };
  }
  if (spaceName || SPACE_HINT.test(base)) {
    return { scope: "space_master", spaceName, eventDate: null };
  }
  return { scope: "general_reference", spaceName: null, eventDate: null };
}

export function isFloorPlanImportFileName(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ["pdf", "png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext);
}

export function matchSpaceCandidates(
  proposedName: string | null | undefined,
  spaces: readonly FloorPlanMatchCandidate[],
): FloorPlanMatchCandidate[] {
  if (!proposedName?.trim()) return [];
  const key = looseKey(proposedName);
  if (key.length < 2) return [];
  const exact = spaces.filter((s) => looseKey(s.name) === key);
  if (exact.length > 0) return exact;
  return spaces.filter((s) => {
    const sk = looseKey(s.name);
    return sk.length >= 3 && (key.includes(sk) || sk.includes(key));
  });
}

export function matchEventCandidates(
  opts: { eventId?: string | null; eventName?: string | null; eventDate?: string | null },
  events: readonly FloorPlanMatchCandidate[],
): FloorPlanMatchCandidate[] {
  if (opts.eventId) {
    const hit = events.find((e) => e.id === opts.eventId);
    return hit ? [hit] : [];
  }
  const date = opts.eventDate?.trim() || null;
  const nameKey = opts.eventName ? looseKey(opts.eventName) : "";
  let pool: FloorPlanMatchCandidate[] = [...events];
  if (date) pool = pool.filter((e) => (e.eventDate ?? "") === date);
  if (nameKey.length >= 3) {
    const named = pool.filter((e) => {
      const nk = looseKey(e.name);
      return nk === nameKey || nk.includes(nameKey) || nameKey.includes(nk);
    });
    if (named.length > 0) return named;
    // Filename often isn't the Event name — fall through to date-only when present.
  }
  // Date-only with a single event that day is high-confidence; multiple stay ambiguous.
  if (date) return pool;
  return [];
}

/**
 * Evaluate association completeness for reconciliation.
 * general_reference never needs a Space/Event.
 * Exact single Space/Event → validated with prefill.
 * Zero or many → needs_review (nothing silently assigned).
 */
export function evaluateFloorPlanMatch(
  normalized: NormalizedFloorPlanImport,
  spaces: readonly FloorPlanMatchCandidate[],
  events: readonly FloorPlanMatchCandidate[],
): FloorPlanMatchOutcome {
  if (normalized.scope === "general_reference") {
    return {
      status: "validated",
      matchType: "none",
      matchConfidence: null,
      matchedEntityId: null,
      validationErrors: null,
      patch: { spaceId: null, eventId: null },
    };
  }

  if (normalized.scope === "space_master") {
    if (normalized.spaceId && spaces.some((s) => s.id === normalized.spaceId)) {
      return {
        status: "validated",
        matchType: "exact",
        matchConfidence: 100,
        matchedEntityId: normalized.spaceId,
        validationErrors: null,
        patch: {},
      };
    }
    const hits = matchSpaceCandidates(normalized.spaceName ?? normalized.name, spaces);
    if (hits.length === 1) {
      return {
        status: "validated",
        matchType: "exact",
        matchConfidence: 95,
        matchedEntityId: hits[0]!.id,
        validationErrors: null,
        patch: { spaceId: hits[0]!.id, spaceName: hits[0]!.name },
      };
    }
    if (hits.length > 1) {
      return {
        status: "needs_review",
        matchType: "likely",
        matchConfidence: 60,
        matchedEntityId: null,
        validationErrors: [
          `Multiple Spaces match “${normalized.spaceName ?? normalized.name}” — pick one before importing.`,
        ],
        patch: { spaceId: null },
      };
    }
    return {
      status: "needs_review",
      matchType: "none",
      matchConfidence: null,
      matchedEntityId: null,
      validationErrors: [
        "Space master floor plans need a Space. Choose one, or switch this file to General reference.",
      ],
      patch: { spaceId: null },
    };
  }

  // event_specific
  if (normalized.eventId && events.some((e) => e.id === normalized.eventId)) {
    return {
      status: "validated",
      matchType: "exact",
      matchConfidence: 100,
      matchedEntityId: normalized.eventId,
      validationErrors: null,
      patch: {},
    };
  }
  const hits = matchEventCandidates(
    {
      eventId: normalized.eventId,
      eventName: normalized.eventName ?? normalized.name,
      eventDate: normalized.eventDate,
    },
    events,
  );
  if (hits.length === 1) {
    return {
      status: "validated",
      matchType: "exact",
      matchConfidence: normalized.eventDate ? 95 : 90,
      matchedEntityId: hits[0]!.id,
      validationErrors: null,
      patch: {
        eventId: hits[0]!.id,
        eventName: hits[0]!.name,
        eventDate: hits[0]!.eventDate ?? normalized.eventDate,
      },
    };
  }
  if (hits.length > 1) {
    return {
      status: "needs_review",
      matchType: "likely",
      matchConfidence: 55,
      matchedEntityId: null,
      validationErrors: [
        "Several Events could match this floor plan — choose the Event before importing.",
      ],
      patch: { eventId: null },
    };
  }
  return {
    status: "needs_review",
    matchType: "none",
    matchConfidence: null,
    matchedEntityId: null,
    validationErrors: [
      "Event-specific floor plans need an Event. Choose one, or switch this file to Space master / General reference.",
    ],
    patch: { eventId: null },
  };
}

export function buildNormalizedFloorPlanImport(row: {
  name?: string | null;
  fileName: string;
  storagePath: string;
  storageUrl: string;
  renderableImageUrl?: string | null;
  mimeType?: string | null;
  fileSize?: string | number | null;
  scope?: string | null;
  spaceId?: string | null;
  spaceName?: string | null;
  eventId?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
  sourceId?: string | null;
  notes?: string | null;
}): NormalizedFloorPlanImport {
  const scopeRaw = (row.scope ?? "general_reference").toLowerCase();
  const scope: FloorPlanImportScope =
    scopeRaw === "space_master" || scopeRaw === "event_specific" || scopeRaw === "general_reference"
      ? scopeRaw
      : "general_reference";
  return {
    name: (row.name ?? displayNameFromFileName(row.fileName)).trim() || row.fileName,
    fileName: row.fileName,
    storagePath: row.storagePath,
    storageUrl: row.storageUrl,
    renderableImageUrl: row.renderableImageUrl ?? (row.mimeType?.startsWith("image/") ? row.storageUrl : null),
    mimeType: row.mimeType ?? null,
    fileSize: row.fileSize == null ? null : String(row.fileSize),
    scope,
    spaceId: row.spaceId ?? null,
    spaceName: row.spaceName ?? null,
    eventId: row.eventId ?? null,
    eventName: row.eventName ?? null,
    eventDate: row.eventDate ?? null,
    sourceId: row.sourceId ?? row.storagePath,
    notes: row.notes ?? null,
  };
}
