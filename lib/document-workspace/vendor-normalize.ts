/**
 * Vendor Workspace normalizers — read-only. The vendor portal authenticates
 * differently from the venue side (vendor session, not a venue owner/staff
 * one), so get_venue_documents() — gated by current_user_venue_id() — can
 * never resolve for a vendor request; that's the existing, correct tenancy
 * boundary, not something this phase touches. These functions normalize
 * data the vendor RPCs *already* return (get_vendor_library_documents,
 * get_vendor_event_detail, get_vendor_uploaded_documents) into the same
 * WorkspaceDocument shape the venue side uses, so the same canonical
 * Card/Preview/Version History render both — nothing about the vendor
 * auth path changes.
 */
import type { VendorEventDetail } from "@/lib/vendors/types";
import type { VendorFloorPlanSummary } from "@/lib/floor-plans/types";
import type { VendorEventUpload, VendorLibraryDocument } from "@/lib/vendor-documents/types";
import type { WorkspaceCategory, WorkspaceDocument } from "@/lib/document-workspace/types";

function mapRawCategory(category: string): WorkspaceCategory {
  switch (category) {
    case "contract": return "Contracts";
    case "invoice_copy": return "Invoices";
    case "questionnaire": return "Questionnaires";
    case "floor_plan": return "Floor Plans";
    case "inspiration":
    case "menu": return "Planning";
    default: return "Other";
  }
}

/** The vendor's own reusable library (app/vendor/documents) — unscoped, no event/relationship. */
export function normalizeVendorLibraryDocuments(library: VendorLibraryDocument[]): WorkspaceDocument[] {
  return library.map((d) => ({
    docType: "document",
    id: d.id,
    name: d.name,
    category: mapRawCategory(d.category),
    rawStatus: null,
    status: "none",
    currentVersion: 1,
    ownerType: "vendor",
    leadId: null, clientId: null, eventId: null, vendorId: null,
    relationshipName: null,
    eventName: null,
    fileUrl: d.storageUrl,
    fileSize: d.fileSize,
    mimeType: d.mimeType,
    isCoupleVisible: false,
    isVendorVisible: true,
    uploadedByType: "vendor",
    createdAt: d.createdAt,
    updatedAt: d.createdAt,
  }));
}

/** One event's folder — venue-shared documents + floor plans + the vendor's own uploads to this event. Mirrors VendorEventDocumentFolder's existing union exactly (Step 1 finding), just re-shaped. */
export function normalizeVendorEventDocuments(
  detail: VendorEventDetail,
  uploads: VendorEventUpload[],
  floorPlans: VendorFloorPlanSummary[],
): WorkspaceDocument[] {
  const now = new Date().toISOString();

  const venueDocs: WorkspaceDocument[] = detail.documents.map((d) => ({
    docType: "document",
    id: d.id,
    name: d.name,
    category: mapRawCategory(d.category),
    rawStatus: null,
    status: "none",
    currentVersion: 1,
    ownerType: "event",
    leadId: null, clientId: null, eventId: detail.eventId, vendorId: null,
    relationshipName: null,
    eventName: detail.eventName,
    fileUrl: d.storageUrl,
    fileSize: null,
    mimeType: d.mimeType,
    isCoupleVisible: false,
    isVendorVisible: true,
    uploadedByType: "venue",
    createdAt: d.createdAt ?? now,
    updatedAt: d.createdAt ?? now,
  }));

  const plans: WorkspaceDocument[] = floorPlans.map((p) => ({
    docType: "floor_plan",
    id: p.id,
    name: p.name,
    category: "Floor Plans",
    rawStatus: null,
    status: "none",
    currentVersion: 1,
    ownerType: "event",
    leadId: null, clientId: null, eventId: detail.eventId, vendorId: null,
    relationshipName: null,
    eventName: detail.eventName,
    fileUrl: `/vendor/floor-plans/${p.id}?from=${encodeURIComponent(detail.assignmentId)}`,
    fileSize: null,
    mimeType: null,
    isCoupleVisible: false,
    isVendorVisible: true,
    uploadedByType: "venue",
    createdAt: p.updatedAt,
    updatedAt: p.updatedAt,
  }));

  const yours: WorkspaceDocument[] = uploads.map((d) => ({
    docType: "document",
    id: d.id,
    name: d.name,
    category: mapRawCategory(d.category),
    rawStatus: null,
    status: "none",
    currentVersion: 1,
    ownerType: "event",
    leadId: null, clientId: null, eventId: detail.eventId, vendorId: null,
    relationshipName: null,
    eventName: detail.eventName,
    fileUrl: d.storageUrl,
    fileSize: null,
    mimeType: d.mimeType,
    isCoupleVisible: !!d.isCoupleVisible,
    isVendorVisible: true,
    uploadedByType: "vendor",
    createdAt: d.createdAt ?? now,
    updatedAt: d.createdAt ?? now,
  }));

  return [...venueDocs, ...plans, ...yours];
}
