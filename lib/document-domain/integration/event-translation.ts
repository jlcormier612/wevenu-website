/**
 * Document Domain — Business Object Integration Contract (Phase 6 / 2B).
 *
 * The Event Translation Layer (§6, §11). "Business Objects publish
 * business events. The integration layer translates those into canonical
 * Document actions... Keep the event streams separate." Concretely: a
 * Business Object never chooses a CanonicalEventType — it calls a generic
 * lifecycle method (createInitialDocument / requestNewVersion /
 * finalizeVersion / requestRepresentation, see contract.ts), and THIS
 * file derives which of the ten certified events that action implies.
 *
 * Every derivation below branches on a certified, generic Document
 * property (Source, or Behavior's capabilities from Phase 4's own
 * canonical_document_behavior_capabilities()) — never on which producer
 * called it. This is what makes §9's "no producer-specific branches"
 * true structurally: there is nowhere in this file a Contract, Invoice,
 * or Questionnaire is named, and there cannot be — the functions below
 * don't accept a producer identifier at all, only a Behavior or a
 * Source, both of which are shared, closed, certified vocabularies.
 */

import { createClient } from "@/integrations/supabase/server";
import type { CanonicalDocumentBehavior, CanonicalDocumentSource, CanonicalEventType } from "@/lib/document-domain/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

/**
 * What canonical event a Document's FIRST version implies — derived from
 * Source alone (a certified, four-value, producer-agnostic property).
 * 'uploaded' is the one Source with an unambiguous, distinct canonical
 * event; every other Source (generated, negotiated, ai_generated) means
 * the Document Domain itself produced or is producing the content, which
 * 'document_generated' already covers without needing three separate
 * events for what is, from the Document Domain's own point of view, the
 * same fact: content came into existence some way other than a raw file
 * upload.
 */
export function eventForInitialVersion(source: CanonicalDocumentSource): CanonicalEventType {
  return source === "uploaded" ? "document_uploaded" : "document_generated";
}

/**
 * Every version revision beyond the first is new content, generated or
 * authored — 'document_generated' regardless of Source, Behavior, or
 * producer. Whether a given revision is significant enough to surface in
 * a human-facing activity feed is a presentation decision made
 * downstream of this raw event stream (architecture Type Matrix §13's
 * Activity/version-change/internal-only split) — not something this
 * layer suppresses at emission time. Every revision is still fully
 * audited (repository.emitEvent() always writes both), regardless.
 */
export function eventForNewVersion(): CanonicalEventType {
  return "document_generated";
}

/**
 * What canonical event "this Business Object is finished" implies —
 * derived entirely from the Document's own Behavior capabilities
 * (Phase 4's canonical_document_behavior_capabilities(), called here,
 * never re-implemented — see errors.ts's own precedent for "reuse, don't
 * duplicate"). This is the function that makes "Contract finalized",
 * "Invoice issued", and "Questionnaire completed" (§5's own three
 * examples) all resolve correctly through one call with zero branching
 * on which of the three actually happened — only their Behavior differs
 * (negotiated / venue_authored / collaborative), and that alone decides
 * the event.
 */
export async function eventForFinalization(client: DbClient, behavior: CanonicalDocumentBehavior): Promise<CanonicalEventType> {
  const { data, error } = await client
    .rpc("canonical_document_behavior_capabilities", { p_behavior: behavior })
    .single<{ signable: boolean; approvable: boolean; generates_representation: boolean }>();
  if (error) throw error;

  if (data.signable) return "document_signed";
  if (data.approvable) return "document_approved";
  if (data.generates_representation) return "document_generated";
  // Reference behavior alone reaches here (signable=false, approvable=false,
  // generates_representation=false per Phase 4's lookup) — finalizing a
  // Reference Document is "publishing" it, which is fundamentally making
  // it visible rather than producing an artifact or requiring sign-off;
  // 'document_shared' is the closest certified event to that fact,
  // chosen rather than inventing an eleventh event outside the certified
  // ten.
  return "document_shared";
}

/** A standalone Representation request (not tied to finalization) is always generation — same reasoning as eventForNewVersion(). */
export function eventForRepresentationRequest(): CanonicalEventType {
  return "document_generated";
}
