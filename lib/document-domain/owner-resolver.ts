/**
 * Document Domain — Adapter Framework (Phase 5 / 2A).
 *
 * The canonical ownership resolver (§5 of this phase's brief). Takes
 * whatever ownership signal an existing producer already carries and
 * resolves it to exactly one of the five certified owner types
 * (architecture §3) — or explicitly refuses to, when no certified type
 * fits.
 *
 * "Do not add a Lead owner. Do not change the certified ownership
 * model." — Lead is deliberately NOT a variant of ProducerOwnerContext.
 * A producer whose only ownership signal is a Lead (the real
 * `documents.lead_id` case found in Phase 1/3) has no path through this
 * resolver at all; see the `lead` case below and docs/document-domain-
 * adapter-plan.md's "Open question" for why, and what would need to be
 * decided — by a product owner, not this resolver — before it could.
 */

import type { CanonicalOwner } from "@/lib/document-domain/types";
import { UnresolvableOwnerError } from "@/lib/document-domain/errors";

export type ProducerOwnerContext =
  | { kind: "venue"; venueId: string }
  | { kind: "client"; clientId: string } // "Relationship" in product language
  | { kind: "event"; eventId: string }
  | { kind: "vendor"; vendorId: string }
  /**
   * Recognized so a caller can pass whatever ownership signal a producer
   * record actually has without pre-filtering — but this variant always
   * resolves to `ok: false`. It exists to make the refusal explicit and
   * typed, rather than making "lead" an unrepresentable input a caller
   * might otherwise coerce into the wrong bucket by mistake.
   */
  | { kind: "lead"; leadId: string }
  /** Explicit, for platform-wide content (legal documents, etc.) — no id required. */
  | { kind: "system" };

export type OwnerResolution =
  | { ok: true; owner: CanonicalOwner }
  | { ok: false; reason: string };

export function resolveCanonicalOwner(context: ProducerOwnerContext): OwnerResolution {
  switch (context.kind) {
    case "system":
      return { ok: true, owner: { type: "system" } };
    case "venue":
      return { ok: true, owner: { type: "venue", id: context.venueId } };
    case "client":
      return { ok: true, owner: { type: "relationship", id: context.clientId } };
    case "event":
      return { ok: true, owner: { type: "event", id: context.eventId } };
    case "vendor":
      return { ok: true, owner: { type: "vendor", id: context.vendorId } };
    case "lead":
      // Explicitly unresolvable. Lead is not a certified owner type
      // (architecture §3) and this phase does not add one. A record
      // owned only by a Lead cannot be adapted into the canonical
      // Document Domain until either (a) the lead converts to a client
      // and the PRODUCER re-resolves against the resulting clientId —
      // not something this resolver does on the producer's behalf — or
      // (b) a product decision adds a sixth owner type, which is a
      // business/architecture decision, not something an adapter
      // resolver may decide unilaterally.
      return { ok: false, reason: "lead_owner_not_certified" };
  }
}

/** Throwing variant for call sites that want to fail fast rather than branch on `ok`. */
export function resolveCanonicalOwnerOrThrow(context: ProducerOwnerContext): CanonicalOwner {
  const result = resolveCanonicalOwner(context);
  if (!result.ok) throw new UnresolvableOwnerError(result.reason);
  return result.owner;
}
