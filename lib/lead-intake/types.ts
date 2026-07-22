/**
 * Lead Intake — shared types.
 *
 * Every source (website form, tour request, manual entry, CSV import,
 * email parser, and future QR/Facebook/API sources) produces the same
 * NormalizedLeadInput and goes through the same pipeline (pipeline.ts).
 * A Source Adapter's only job is mapping its own raw payload into
 * RawIntakeInput below — nothing downstream is ever source-specific.
 */
import type { createClient } from "@/integrations/supabase/server";
import type { createAdminClient } from "@/integrations/supabase/admin";

export type DbClient = Awaited<ReturnType<typeof createClient>>;
export type AnyDbClient = DbClient | ReturnType<typeof createAdminClient>;

export type TrustTier = "direct" | "webhook" | "email_parsed" | "import" | "manual";

/** Pre-normalization shape a Source Adapter produces. */
export type RawIntakeInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
  partnerEmail?: string | null;
  eventType?: string | null;
  eventDate?: string | null; // ISO "YYYY-MM-DD"
  endDate?: string | null;
  guestCount?: number | null;
  estimatedBudget?: number | null;
  inquiryMessage?: string | null;
  inquiryDate?: string | null;
  /** 0-100, assisted/extracted sources only (email-parsed today). */
  confidenceScore?: number | null;
  sourceData?: Record<string, unknown>;
};

/** Post Normalize (trim/case/format), pre-Validate. */
export type NormalizedLeadInput = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  partnerEmail: string | null;
  eventType: string | null;
  eventDate: string | null;
  endDate: string | null;
  guestCount: number | null;
  estimatedBudget: number | null;
  inquiryMessage: string | null;
  inquiryDate: string | null;
  confidenceScore: number | null;
  sourceData: Record<string, unknown>;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** What a Source Adapter's `create` callback returns — no attemptId, since the adapter itself doesn't generate it. */
export type CreateOutcome =
  | { ok: true; leadId: string; relationshipId: string; isReturningRelationship: boolean }
  | { ok: false; error: string };

/** What the pipeline itself returns — same shape, plus the attemptId so a caller can later record a notification outcome against the same log row. */
export type IngestOutcome =
  | { ok: true; leadId: string; relationshipId: string; isReturningRelationship: boolean; attemptId: string | null }
  | { ok: false; error: string; attemptId: string | null };

export type IngestLeadOptions = {
  supabase: AnyDbClient;
  /** Null when the source itself couldn't resolve a venue (e.g. a bad embed_key) — the attempt is still logged. */
  venueId: string | null;
  source: string;
  trustTier: TrustTier;
  input: RawIntakeInput;
  /** Untouched original payload — form body, RPC args, CSV row, raw email — stored forever, separate from the normalized result. */
  rawPayload: unknown;
  ipAddress?: string | null;
  /** Cloudflare Turnstile token from the submitting form, if the widget rendered one. Optional below the rate-limit escalation threshold, required at/above it. */
  turnstileToken?: string | null;
  /**
   * Idempotency key for a webhook source that may redeliver the same event
   * (Meta Lead Ads' leadgen_id, a future integration's own stable ID, etc).
   * Threaded straight through to logIntakeAttempt, whose
   * lead_intake_attempts_external_ref unique partial index
   * (source, external_ref) was built for exactly this — a redelivered
   * webhook for an already-logged external_ref is a safe no-op at the
   * attempt-log layer, before any lead-creation logic even runs.
   */
  externalRef?: string | null;
  /** The source-specific RPC call, invoked with the finalized normalized+validated input. */
  create: (normalized: NormalizedLeadInput) => Promise<CreateOutcome>;
};
