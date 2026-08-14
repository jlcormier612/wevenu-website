/**
 * In-process legal domain events. No persistence, no registered listeners in WP2.
 * Workflows may subscribe later without changing acceptance write paths.
 */

import type { LegalAcceptanceUserType } from "@/lib/legal/required-documents";
import type {
  LegalAcceptance,
  LegalDocument,
  LegalDocumentType,
} from "@/lib/legal/types";

export type LegalDocumentAcceptedEvent = {
  type: "LegalDocumentAccepted";
  userId: string;
  userType: LegalAcceptanceUserType;
  document: LegalDocument;
  acceptance: LegalAcceptance;
  relationshipId: string | null;
  at: string;
};

export type LegalRequirementsSatisfiedEvent = {
  type: "LegalRequirementsSatisfied";
  userId: string;
  userType: LegalAcceptanceUserType;
  relationshipId: string | null;
  /** Document types that are now current for the user. */
  satisfiedDocumentTypes: readonly LegalDocumentType[];
  at: string;
};

export type LegalDomainEvent =
  | LegalDocumentAcceptedEvent
  | LegalRequirementsSatisfiedEvent;

export type LegalEventListener = (event: LegalDomainEvent) => void;

const listeners = new Set<LegalEventListener>();

/** Subscribe to legal domain events. Returns unsubscribe. */
export function subscribeLegalEvents(
  listener: LegalEventListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Publish a legal domain event to in-process subscribers (sync, best-effort). */
export function publishLegalEvent(event: LegalDomainEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Listeners must not break acceptance writes.
    }
  }
}

/** Test helper — clear all subscribers. */
export function clearLegalEventListeners(): void {
  listeners.clear();
}
