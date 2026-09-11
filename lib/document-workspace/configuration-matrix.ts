/**
 * Documents configuration matrix — the implementation contract for the
 * Documents experience layer. Producer business objects remain authoritative.
 * Cells marked "n/a" are intentionally unsupported (not unfinished).
 */

export type MatrixActor = "venue" | "couple" | "vendor" | "n/a";
export type MatrixCapability = "yes" | "n/a" | "producer";

export type DocumentProducerKey =
  | "ordinary_upload"
  | "questionnaire"
  | "contract"
  | "event_order"
  | "vendor_document"
  | "couple_document"
  | "conversation_attachment"
  | "finalized_contract_pdf"
  | "finalized_event_order_pdf"
  | "invoice"
  | "floor_plan";

export type DocumentProducerMatrixRow = {
  key: DocumentProducerKey;
  label: string;
  businessObjectOwner: string;
  artifactSource: string;
  venueParticipant: MatrixActor;
  coupleParticipant: MatrixActor;
  vendorParticipant: MatrixActor;
  save: MatrixCapability;
  submit: MatrixCapability;
  handoff: MatrixCapability;
  review: MatrixCapability;
  requestChanges: MatrixCapability;
  resubmit: MatrixCapability;
  completion: MatrixCapability;
  finalization: MatrixCapability;
  versionHistory: MatrixCapability;
  emitsTasks: boolean;
  emitsNotifications: boolean;
  appearsInDocumentsWorkspace: boolean;
  remainsInProducerWorkspace: boolean;
  notes: string;
};

export const DOCUMENT_CONFIGURATION_MATRIX: readonly DocumentProducerMatrixRow[] = [
  {
    key: "ordinary_upload",
    label: "Ordinary uploaded document",
    businessObjectOwner: "public.documents",
    artifactSource: "documents storage bucket (current file + prior file versions)",
    venueParticipant: "venue",
    coupleParticipant: "couple",
    vendorParticipant: "vendor",
    save: "yes",
    submit: "n/a",
    handoff: "n/a",
    review: "n/a",
    requestChanges: "n/a",
    resubmit: "n/a",
    completion: "n/a",
    finalization: "n/a",
    versionHistory: "yes",
    emitsTasks: true,
    emitsNotifications: false,
    appearsInDocumentsWorkspace: true,
    remainsInProducerWorkspace: false,
    notes: "Simple file. Replace keeps prior file. Sharing flags only — not a collaborative editor. Category=contract is a companion upload, never a second signed-contract truth.",
  },
  {
    key: "questionnaire",
    label: "Questionnaire",
    businessObjectOwner: "event_questionnaires",
    artifactSource: "questionnaire answers + append-only questionnaire_submissions",
    venueParticipant: "venue",
    coupleParticipant: "couple",
    vendorParticipant: "n/a",
    save: "yes",
    submit: "yes",
    handoff: "yes",
    review: "yes",
    requestChanges: "yes",
    resubmit: "yes",
    completion: "yes",
    finalization: "n/a",
    versionHistory: "yes",
    emitsTasks: true,
    emitsNotifications: true,
    appearsInDocumentsWorkspace: true,
    remainsInProducerWorkspace: true,
    notes: "Primary multi-party handoff. Documents surfaces state/next actor; Tasks/Notifications remain their own products.",
  },
  {
    key: "contract",
    label: "Contract (working record)",
    businessObjectOwner: "contracts",
    artifactSource: "contract content + signing lifecycle",
    venueParticipant: "venue",
    coupleParticipant: "couple",
    vendorParticipant: "n/a",
    save: "producer",
    submit: "producer",
    handoff: "producer",
    review: "n/a",
    requestChanges: "n/a",
    resubmit: "n/a",
    completion: "producer",
    finalization: "producer",
    versionHistory: "producer",
    emitsTasks: false,
    emitsNotifications: false,
    appearsInDocumentsWorkspace: true,
    remainsInProducerWorkspace: true,
    notes: "Documents representation/link only. Do not reopen Contracts architecture. Create New Version is the revision path.",
  },
  {
    key: "finalized_contract_pdf",
    label: "Finalized contract PDF",
    businessObjectOwner: "canonical representation produced by Contracts",
    artifactSource: "contract-representations private bucket via signed URL",
    venueParticipant: "venue",
    coupleParticipant: "couple",
    vendorParticipant: "n/a",
    save: "n/a",
    submit: "n/a",
    handoff: "n/a",
    review: "n/a",
    requestChanges: "n/a",
    resubmit: "n/a",
    completion: "yes",
    finalization: "yes",
    versionHistory: "producer",
    emitsTasks: false,
    emitsNotifications: false,
    appearsInDocumentsWorkspace: true,
    remainsInProducerWorkspace: true,
    notes: "Authoritative immutable artifact. Never duplicated as a mutable generic documents row.",
  },
  {
    key: "event_order",
    label: "Event Order",
    businessObjectOwner: "event_orders",
    artifactSource: "event order record + optional shared PDF representation",
    venueParticipant: "venue",
    coupleParticipant: "couple",
    vendorParticipant: "n/a",
    save: "producer",
    submit: "n/a",
    handoff: "producer",
    review: "n/a",
    requestChanges: "n/a",
    resubmit: "n/a",
    completion: "producer",
    finalization: "producer",
    versionHistory: "producer",
    emitsTasks: true,
    emitsNotifications: false,
    appearsInDocumentsWorkspace: true,
    remainsInProducerWorkspace: true,
    notes: "Workspace representation/link. Documents does not own Event Order editing.",
  },
  {
    key: "finalized_event_order_pdf",
    label: "Shared Event Order PDF",
    businessObjectOwner: "canonical representation produced by Event Orders",
    artifactSource: "event-order representations private bucket via signed URL",
    venueParticipant: "venue",
    coupleParticipant: "couple",
    vendorParticipant: "n/a",
    save: "n/a",
    submit: "n/a",
    handoff: "n/a",
    review: "n/a",
    requestChanges: "n/a",
    resubmit: "n/a",
    completion: "yes",
    finalization: "yes",
    versionHistory: "producer",
    emitsTasks: false,
    emitsNotifications: false,
    appearsInDocumentsWorkspace: true,
    remainsInProducerWorkspace: true,
    notes: "Authoritative shared snapshot. Download goes through Event Order signed URL, never a rebuilt live PDF.",
  },
  {
    key: "vendor_document",
    label: "Vendor document (shared into an event)",
    businessObjectOwner: "public.documents (uploaded_by_type=vendor) or vendor library",
    artifactSource: "documents bucket or vendors bucket",
    venueParticipant: "venue",
    coupleParticipant: "couple",
    vendorParticipant: "vendor",
    save: "yes",
    submit: "n/a",
    handoff: "n/a",
    review: "n/a",
    requestChanges: "n/a",
    resubmit: "n/a",
    completion: "n/a",
    finalization: "n/a",
    versionHistory: "yes",
    emitsTasks: true,
    emitsNotifications: true,
    appearsInDocumentsWorkspace: true,
    remainsInProducerWorkspace: true,
    notes: "Vendor Library remains a vendor product. Only event-shared/promoted files appear in venue Documents.",
  },
  {
    key: "couple_document",
    label: "Couple upload",
    businessObjectOwner: "couple_documents and/or public.documents when shared",
    artifactSource: "client-media (couple upload) or documents (venue-shared)",
    venueParticipant: "venue",
    coupleParticipant: "couple",
    vendorParticipant: "n/a",
    save: "yes",
    submit: "n/a",
    handoff: "n/a",
    review: "n/a",
    requestChanges: "n/a",
    resubmit: "n/a",
    completion: "n/a",
    finalization: "n/a",
    versionHistory: "n/a",
    emitsTasks: true,
    emitsNotifications: false,
    appearsInDocumentsWorkspace: true,
    remainsInProducerWorkspace: true,
    notes: "Couple portal remains the couple-facing workspace. Venue Documents shows shared/event-attached files only.",
  },
  {
    key: "conversation_attachment",
    label: "Conversation attachment",
    businessObjectOwner: "conversation_message_attachments until promoted",
    artifactSource: "couple-messages bucket; Documents row on deliberate promotion",
    venueParticipant: "venue",
    coupleParticipant: "couple",
    vendorParticipant: "n/a",
    save: "n/a",
    submit: "n/a",
    handoff: "n/a",
    review: "n/a",
    requestChanges: "n/a",
    resubmit: "n/a",
    completion: "n/a",
    finalization: "n/a",
    versionHistory: "n/a",
    emitsTasks: false,
    emitsNotifications: false,
    appearsInDocumentsWorkspace: false,
    remainsInProducerWorkspace: true,
    notes: "Inbox attachments stay Inbox unless deliberately promoted. Never guess event when multiple events exist.",
  },
  {
    key: "invoice",
    label: "Invoice",
    businessObjectOwner: "invoices",
    artifactSource: "invoice record (producer workspace)",
    venueParticipant: "venue",
    coupleParticipant: "couple",
    vendorParticipant: "n/a",
    save: "producer",
    submit: "producer",
    handoff: "producer",
    review: "n/a",
    requestChanges: "n/a",
    resubmit: "n/a",
    completion: "producer",
    finalization: "n/a",
    versionHistory: "n/a",
    emitsTasks: false,
    emitsNotifications: false,
    appearsInDocumentsWorkspace: true,
    remainsInProducerWorkspace: true,
    notes: "Representation/link only. Invoices remain the financial product.",
  },
  {
    key: "floor_plan",
    label: "Floor plan",
    businessObjectOwner: "floor_plans",
    artifactSource: "floor plan editor + optional background document",
    venueParticipant: "venue",
    coupleParticipant: "couple",
    vendorParticipant: "vendor",
    save: "producer",
    submit: "n/a",
    handoff: "n/a",
    review: "n/a",
    requestChanges: "n/a",
    resubmit: "n/a",
    completion: "n/a",
    finalization: "n/a",
    versionHistory: "n/a",
    emitsTasks: false,
    emitsNotifications: false,
    appearsInDocumentsWorkspace: true,
    remainsInProducerWorkspace: true,
    notes: "Floor Plans remain Floor Plans. Workspace shows a link/representation, not canvas internals.",
  },
];

export function matrixRow(key: DocumentProducerKey): DocumentProducerMatrixRow {
  const row = DOCUMENT_CONFIGURATION_MATRIX.find((r) => r.key === key);
  if (!row) throw new Error(`Unknown document producer: ${key}`);
  return row;
}

/** True when Documents Workspace may list this producer. */
export function appearsInWorkspace(key: DocumentProducerKey): boolean {
  return matrixRow(key).appearsInDocumentsWorkspace;
}
