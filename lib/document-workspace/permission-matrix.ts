/**
 * Documents permission matrix — what each actor can actually do.
 * Enforcement is RLS / SECURITY DEFINER RPC / authorized file routes.
 * UI hiding is not sufficient.
 */

export type DocumentsActor = "owner" | "manager" | "coordinator" | "couple" | "vendor";

export type DocumentsContext =
  | "venue_document"
  | "lead_document"
  | "client_document"
  | "event_document"
  | "questionnaire"
  | "contract_artifact"
  | "event_order_artifact"
  | "vendor_document"
  | "couple_upload"
  | "promoted_attachment";

export type DocumentsAction =
  | "read"
  | "create"
  | "edit_metadata"
  | "replace"
  | "delete"
  | "share"
  | "portal_visible"
  | "vendor_visible"
  | "cross_event"
  | "cross_venue";

export type PermissionCell = true | false | "own_event" | "when_shared" | "producer_only";

export const DOCUMENTS_PERMISSION_MATRIX: Record<
  DocumentsActor,
  Record<DocumentsContext, Partial<Record<DocumentsAction, PermissionCell>>>
> = {
  owner: {
    venue_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_venue: false },
    lead_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_event: false, cross_venue: false },
    client_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_venue: false },
    event_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_event: false, cross_venue: false },
    questionnaire: { read: true, create: true, edit_metadata: false, replace: false, delete: true, share: true, portal_visible: true, cross_venue: false },
    contract_artifact: { read: true, create: false, edit_metadata: false, replace: false, delete: false, share: "producer_only", portal_visible: true, cross_venue: false },
    event_order_artifact: { read: true, create: false, edit_metadata: false, replace: false, delete: false, share: "producer_only", portal_visible: "when_shared", cross_venue: false },
    vendor_document: { read: true, create: false, edit_metadata: true, replace: true, delete: true, share: true, vendor_visible: true, cross_venue: false },
    couple_upload: { read: true, create: false, edit_metadata: false, replace: false, delete: false, portal_visible: true, cross_venue: false },
    promoted_attachment: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_event: false, cross_venue: false },
  },
  manager: {
    venue_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_venue: false },
    lead_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_venue: false },
    client_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_venue: false },
    event_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_event: false, cross_venue: false },
    questionnaire: { read: true, create: true, edit_metadata: false, replace: false, delete: true, share: true, portal_visible: true, cross_venue: false },
    contract_artifact: { read: true, create: false, edit_metadata: false, replace: false, delete: false, share: "producer_only", cross_venue: false },
    event_order_artifact: { read: true, create: false, edit_metadata: false, replace: false, delete: false, share: "producer_only", cross_venue: false },
    vendor_document: { read: true, create: false, edit_metadata: true, replace: true, delete: true, vendor_visible: true, cross_venue: false },
    couple_upload: { read: true, create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
    promoted_attachment: { read: true, create: true, edit_metadata: true, replace: true, delete: true, cross_event: false, cross_venue: false },
  },
  coordinator: {
    venue_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_venue: false },
    lead_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_venue: false },
    client_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_venue: false },
    event_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, share: true, cross_event: false, cross_venue: false },
    questionnaire: { read: true, create: true, edit_metadata: false, replace: false, delete: true, share: true, portal_visible: true, cross_venue: false },
    contract_artifact: { read: true, create: false, edit_metadata: false, replace: false, delete: false, share: "producer_only", cross_venue: false },
    event_order_artifact: { read: true, create: false, edit_metadata: false, replace: false, delete: false, share: "producer_only", cross_venue: false },
    vendor_document: { read: true, create: false, edit_metadata: true, replace: true, delete: true, vendor_visible: true, cross_venue: false },
    couple_upload: { read: true, create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
    promoted_attachment: { read: true, create: true, edit_metadata: true, replace: true, delete: true, cross_event: false, cross_venue: false },
  },
  couple: {
    venue_document: { read: "when_shared", create: false, edit_metadata: false, replace: false, delete: false, portal_visible: "when_shared", cross_venue: false },
    lead_document: { read: false, create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
    client_document: { read: "when_shared", create: false, edit_metadata: false, replace: false, delete: false, portal_visible: "when_shared", cross_venue: false },
    event_document: { read: "when_shared", create: false, edit_metadata: false, replace: false, delete: false, portal_visible: "when_shared", cross_event: false, cross_venue: false },
    questionnaire: { read: true, create: false, edit_metadata: true, replace: false, delete: false, portal_visible: true, cross_venue: false },
    contract_artifact: { read: "when_shared", create: false, edit_metadata: false, replace: false, delete: false, portal_visible: "when_shared", cross_venue: false },
    event_order_artifact: { read: "when_shared", create: false, edit_metadata: false, replace: false, delete: false, portal_visible: "when_shared", cross_venue: false },
    vendor_document: { read: "when_shared", create: false, edit_metadata: false, replace: false, delete: false, portal_visible: "when_shared", cross_venue: false },
    couple_upload: { read: true, create: true, edit_metadata: false, replace: false, delete: false, portal_visible: true, cross_venue: false },
    promoted_attachment: { read: "when_shared", create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
  },
  vendor: {
    venue_document: { read: false, create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
    lead_document: { read: false, create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
    client_document: { read: false, create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
    event_document: { read: "when_shared", create: true, edit_metadata: false, replace: false, delete: false, vendor_visible: "when_shared", cross_event: "own_event", cross_venue: false },
    questionnaire: { read: false, create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
    contract_artifact: { read: false, create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
    event_order_artifact: { read: false, create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
    vendor_document: { read: true, create: true, edit_metadata: true, replace: true, delete: true, vendor_visible: true, cross_venue: false },
    couple_upload: { read: false, create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
    promoted_attachment: { read: false, create: false, edit_metadata: false, replace: false, delete: false, cross_venue: false },
  },
};

export function permission(
  actor: DocumentsActor,
  context: DocumentsContext,
  action: DocumentsAction,
): PermissionCell {
  return DOCUMENTS_PERMISSION_MATRIX[actor][context][action] ?? false;
}
