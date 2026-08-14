/**
 * Document Domain — Adapter Framework (Phase 5 / 2A).
 *
 * Shared adapter infrastructure (§4 of this phase's brief), the
 * orchestration layer. Everything here is producer-agnostic — it
 * combines the repository functions (repository.ts) into the handful of
 * multi-step flows every producer adapter needs, so a future producer-
 * specific adapter (none implemented this phase, §9) never re-implements
 * "create a document, reference it back to my own row, emit the right
 * event" from scratch.
 *
 * No business rules live here. Every function below is generic over its
 * inputs; none of them know what a Contract, a Vendor Document, or a
 * Floor Plan export is.
 */

import { createClient } from "@/integrations/supabase/server";
import * as repo from "@/lib/document-domain/repository";
import type {
  AdaptProducerInput,
  AdaptProducerResult,
  CanonicalActor,
  CanonicalRepresentationType,
  CanonicalStorageProvider,
} from "@/lib/document-domain/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The one orchestrated, idempotent "bring a producer record into the
 * canonical Document Domain" flow. This is what §4's "Base adapter"
 * means concretely: every producer-specific adapter's createDocument()
 * method (adapter-interface.ts) should be a thin wrapper that resolves
 * its own owner (owner-resolver.ts) and then calls exactly this.
 */
export async function adaptProducerToCanonicalDocument(
  client: DbClient,
  input: AdaptProducerInput,
): Promise<AdaptProducerResult> {
  return repo.adaptProducerToCanonicalDocument(client, input);
}

/**
 * Orchestrates "create a new Version, and if this Behavior generates a
 * Representation, create + attach it, then lock the Version." This is
 * the shape every Negotiated/Venue-Authored/Generated producer's
 * "createVersion" + "generateRepresentation" pair reduces to — kept as
 * one shared function specifically so no producer adapter reinvents the
 * "create version, then representation, then lock" ordering, which
 * matters: locking before the representation exists would let a
 * Document reach 'finalized' status with no immutable artifact behind
 * it, which the Phase 4 trigger already refuses (see errors.ts's
 * InvalidTransitionError) — this function exists so no adapter has to
 * rediscover that ordering constraint by trial and error.
 */
export async function createVersionWithRepresentation(
  client: DbClient,
  input: {
    documentId: string;
    content?: string | null;
    createdBy: CanonicalActor;
    representation: {
      type: CanonicalRepresentationType;
      storageProvider?: CanonicalStorageProvider;
      storagePath?: string | null;
      storageUrl?: string | null;
      mimeType?: string | null;
      byteSize?: number | null;
      checksum?: string | null;
      generatedBy: CanonicalActor;
    } | null; // null for Behaviors that never generate one (e.g. a still-open Draft)
    lock: boolean;
  },
): Promise<{ versionId: string; representationId: string | null }> {
  const { versionId } = await repo.createVersion(client, {
    documentId: input.documentId,
    content: input.content,
    createdBy: input.createdBy,
  });

  let representationId: string | null = null;
  if (input.representation) {
    const rep = await repo.createRepresentation(client, {
      versionId,
      representationType: input.representation.type,
      storageProvider: input.representation.storageProvider,
      storagePath: input.representation.storagePath,
      storageUrl: input.representation.storageUrl,
      mimeType: input.representation.mimeType,
      byteSize: input.representation.byteSize,
      checksum: input.representation.checksum,
      generatedBy: input.representation.generatedBy,
    });
    representationId = rep.representationId;
  }

  if (input.lock) {
    await repo.lockVersion(client, versionId);
  }

  return { versionId, representationId };
}

/**
 * Re-exported directly rather than wrapped — these already ARE the
 * shared, producer-agnostic primitives §4 asks for; there is nothing to
 * orchestrate beyond what repository.ts already does for a single
 * reference, an event, or a status transition. Re-exporting here means a
 * producer adapter only ever imports from base-adapter.ts, never reaches
 * into repository.ts directly — keeping exactly one entry point into the
 * shared framework, matching §13's "exactly one architectural path."
 */
export const addReference = repo.addReference;
export const emitEvent = repo.emitEvent;
export const transitionStatus = repo.transitionStatus;
