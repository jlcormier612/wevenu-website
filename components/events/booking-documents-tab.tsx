"use client";

import { DocumentWorkspace } from "@/components/document-workspace/document-workspace";
import type { Contract, ContractTemplate } from "@/lib/contracts/types";
import type { Document, DocumentEntityType } from "@/lib/documents/types";
import type { WorkspaceDocument } from "@/lib/document-workspace/types";
import type { Questionnaire } from "@/lib/events/questionnaire";
import {
  isReturnedQuestionnaireDocumentStatus,
} from "@/lib/document-workspace/questionnaire-document-status";

/**
 * Booking Documents tab — same Documents workspace recipe as Lead.
 * Event contracts and returned questionnaires appear in the document list
 * (not as orphan cards above the primary Documents title).
 */
export function BookingDocumentsTab({
  entityType, entityId, venueId,
  workspaceDocuments = [], pinnedDocumentKeys = [],
  contractTemplates: _contractTemplates, contracts: _contracts, questionnaire: _questionnaire,
  eventId: _eventId, eventName: _eventName, coupleEmail: _coupleEmail, coupleName: _coupleName,
  returnTo,
}: {
  entityType: DocumentEntityType;
  entityId: string;
  venueId: string;
  documents: Document[];
  vendorDocuments?: (Document & { vendorName: string | null })[];
  workspaceDocuments?: WorkspaceDocument[];
  pinnedDocumentKeys?: string[];
  /** @deprecated Templates are not event documents — kept for call-site compatibility. */
  contractTemplates: ContractTemplate[];
  contracts: Contract[];
  questionnaire: Questionnaire | null;
  eventId: string;
  eventName: string;
  coupleEmail: string | null;
  coupleName: string | null;
  /** Client Workspace path for Contract Detail back navigation. */
  returnTo?: string;
}) {
  void _contractTemplates;
  void _contracts;
  void _questionnaire;
  void _eventId;
  void _eventName;
  void _coupleEmail;
  void _coupleName;

  const artifactDocuments = workspaceDocuments.filter(
    (d) =>
      d.docType !== "questionnaire"
      || isReturnedQuestionnaireDocumentStatus(d.rawStatus),
  );

  return (
    <div className="space-y-4" data-testid="booking-documents-tab">
      <DocumentWorkspace
        title="Documents"
        description="Files and completed records for this booking — uploaded by your venue, the client, or shared by vendors. Reusable templates and send actions live in Library and the Questionnaires / Contracts workflows. A questionnaire appears here only after the couple returns it."
        documents={artifactDocuments}
        initialPinnedKeys={pinnedDocumentKeys}
        uploadTarget={{ entityType, entityId, venueId }}
        returnTo={returnTo}
      />
    </div>
  );
}
