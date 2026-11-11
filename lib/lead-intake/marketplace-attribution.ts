/**
 * Marketplace attribution for the Email Intake Engine.
 *
 * Marketplace source (The Knot, WeddingWire, Zola, Here Comes the Guide) and
 * ingestion method (email_forward) are separate. An inquiry can arrive by
 * email forward and still be attributed to a marketplace — but only when
 * evidence is trustworthy. An arbitrary From address, display name, or
 * user-editable subject alone is never enough.
 *
 * Provider-specific parsers plug in here later with genuine message samples.
 * Until then, classifyMarketplaceAttribution returns null and the lead is
 * stored as email_parsed_generic with the email metadata preserved.
 */

export const MARKETPLACE_SOURCE_KEYS = [
  "the_knot",
  "wedding_wire",
  "zola",
  "here_comes_the_guide",
] as const;

export type MarketplaceSourceKey = (typeof MARKETPLACE_SOURCE_KEYS)[number];

/** Technical path that delivered the inquiry — not the marketplace brand. */
export const EMAIL_FORWARD_INGESTION_METHOD = "email_forward" as const;

const MARKETPLACE_ALIASES: Record<string, MarketplaceSourceKey> = {
  the_knot: "the_knot",
  theknot: "the_knot",
  knot: "the_knot",
  wedding_wire: "wedding_wire",
  weddingwire: "wedding_wire",
  wedding_wire_com: "wedding_wire",
  zola: "zola",
  here_comes_the_guide: "here_comes_the_guide",
  herecomestheguide: "here_comes_the_guide",
  hctg: "here_comes_the_guide",
};

export function isMarketplaceSourceKey(value: string | null | undefined): value is MarketplaceSourceKey {
  return !!value && (MARKETPLACE_SOURCE_KEYS as readonly string[]).includes(value);
}

/**
 * Normalize free-text / legacy identifiers onto the lead_sources keys.
 * Migration Center uses source_profiles key `weddingwire`; leads use
 * `wedding_wire`. Both resolve here.
 */
export function normalizeMarketplaceSourceKey(
  raw: string | null | undefined,
): MarketplaceSourceKey | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
  return MARKETPLACE_ALIASES[normalized] ?? null;
}

export type MarketplaceAttributionEvidence = {
  from?: string | null;
  subject?: string | null;
  /** Lowercase header map from Resend retrieve, when available. */
  headers?: Record<string, string> | null;
  body?: string | null;
  /**
   * Explicit, already-trusted classification from a future provider adapter
   * or venue-configured mapping. Never pass a guess derived only from From.
   */
  trustedMarketplaceKey?: string | null;
};

export type MarketplaceAttributionResult = {
  marketplaceSource: MarketplaceSourceKey | null;
  ingestionMethod: typeof EMAIL_FORWARD_INGESTION_METHOD;
  /** Why attribution was set or withheld — for source_data / troubleshooting. */
  evidenceNotes: string[];
};

/**
 * Decide marketplace source for an inbound inquiry email.
 * Without a trustedMarketplaceKey, returns null — keep the inquiry, do not invent.
 */
export function classifyMarketplaceAttribution(
  evidence: MarketplaceAttributionEvidence,
): MarketplaceAttributionResult {
  const notes: string[] = [];
  const trusted = normalizeMarketplaceSourceKey(evidence.trustedMarketplaceKey ?? null);
  if (trusted) {
    notes.push(`trusted_key:${trusted}`);
    return {
      marketplaceSource: trusted,
      ingestionMethod: EMAIL_FORWARD_INGESTION_METHOD,
      evidenceNotes: notes,
    };
  }

  // From / subject / body alone are not treated as proof. Provider adapters
  // may add structural checks here once genuine samples exist.
  if (evidence.from?.trim()) notes.push("from_present_untrusted");
  if (evidence.subject?.trim()) notes.push("subject_present_untrusted");
  if (evidence.body?.trim()) notes.push("body_present");
  if (evidence.headers && Object.keys(evidence.headers).length > 0) {
    notes.push("headers_present");
  }
  notes.push("marketplace_unattributed");

  return {
    marketplaceSource: null,
    ingestionMethod: EMAIL_FORWARD_INGESTION_METHOD,
    evidenceNotes: notes,
  };
}

/** Lead + attempt source key: marketplace when attributed, else the generic email-forward channel. */
export function emailIntakeLeadSourceKey(
  attribution: MarketplaceAttributionResult,
): string {
  return attribution.marketplaceSource ?? "email_parsed_generic";
}

const HEADER_KEEP = [
  "message-id",
  "in-reply-to",
  "references",
  "reply-to",
  "return-path",
  "x-mailer",
  "list-id",
] as const;

/** Store a small, useful header subset — not the full raw mail dump. */
export function selectInboundEmailHeaders(
  headers: Record<string, string> | null | undefined,
): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  for (const name of HEADER_KEEP) {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (typeof value === "string" && value.trim()) out[name] = value.trim();
  }
  return out;
}

export function buildEmailIntakeSourceData(opts: {
  attribution: MarketplaceAttributionResult;
  emailId: string;
  from: string | null | undefined;
  subject: string | null | undefined;
  headers?: Record<string, string> | null;
  extractedSubject?: string | null;
  priorSourceData?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const selectedHeaders = selectInboundEmailHeaders(opts.headers);
  return {
    ...(opts.priorSourceData ?? {}),
    extracted_subject: opts.extractedSubject ?? opts.subject ?? null,
    ingestion_method: opts.attribution.ingestionMethod,
    marketplace_source: opts.attribution.marketplaceSource,
    attribution_notes: opts.attribution.evidenceNotes,
    inbound_email_id: opts.emailId,
    inbound_from: opts.from ?? null,
    inbound_subject: opts.subject ?? null,
    inbound_headers: Object.keys(selectedHeaders).length > 0 ? selectedHeaders : null,
  };
}
