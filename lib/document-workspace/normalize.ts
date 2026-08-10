import type { WorkspaceCategory, WorkspaceDocument, WorkspaceStatus } from "@/lib/document-workspace/types";

/** Raw shape returned by get_venue_documents() — one row per producer leg, already jsonb_build_object'd in SQL. */
type RawRow = {
  docType: WorkspaceDocument["docType"];
  id: string;
  name: string;
  category: string | null;
  status: string | null;
  currentVersion: number;
  ownerType: WorkspaceDocument["ownerType"];
  leadId: string | null;
  clientId: string | null;
  eventId: string | null;
  vendorId: string | null;
  relationshipName: string | null;
  eventName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  isCoupleVisible: boolean;
  isVendorVisible: boolean;
  uploadedByType: "venue" | "vendor";
  amount?: number | null;
  balanceDue?: number | null;
  signToken?: string | null;
  signedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

// Vendor-sourced files are grouped under "Vendor Documents" regardless of
// their raw category (a COI uploaded by a vendor is more useful to find
// under "who gave me this" than under "Insurance") — the one judgment call
// in this mapping, everything else is a direct 1:1 from the producer.
export function mapCategory(row: RawRow): WorkspaceCategory {
  if (row.uploadedByType === "vendor") return "Vendor Documents";
  switch (row.docType) {
    case "contract": return "Contracts";
    case "invoice": return "Invoices";
    case "floor_plan": return "Floor Plans";
    case "questionnaire": return "Questionnaires";
    case "document":
      switch (row.category) {
        case "contract": return "Contracts";
        case "invoice_copy": return "Invoices";
        case "questionnaire": return "Questionnaires";
        case "floor_plan": return "Floor Plans";
        case "inspiration":
        case "menu": return "Planning";
        default: return "Other";
      }
    default: return "Other";
  }
}

function mapStatus(row: RawRow): WorkspaceStatus {
  if (row.docType === "contract") {
    if (row.status === "signed") return "complete";
    if (row.status === "sent") return "action_needed";
    if (row.status === "draft") return "in_progress";
    return "none"; // cancelled / expired
  }
  if (row.docType === "invoice") {
    if (row.status === "paid") return "complete";
    if (row.status === "sent") return "action_needed";
    if (row.status === "draft") return "in_progress";
    return "none"; // void
  }
  if (row.docType === "questionnaire") {
    if (row.status === "reviewed") return "complete";
    if (row.status === "submitted") return "in_progress";
    return "action_needed"; // sent, awaiting the couple
  }
  return "none"; // document / floor_plan — no producer status concept
}

export function normalizeWorkspaceDocument(row: RawRow): WorkspaceDocument {
  return {
    docType: row.docType,
    id: row.id,
    name: row.name,
    category: mapCategory(row),
    rawStatus: row.status,
    status: mapStatus(row),
    currentVersion: row.currentVersion ?? 1,
    ownerType: row.ownerType,
    leadId: row.leadId,
    clientId: row.clientId,
    eventId: row.eventId,
    vendorId: row.vendorId,
    relationshipName: row.relationshipName,
    eventName: row.eventName,
    fileUrl: row.fileUrl,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    isCoupleVisible: !!row.isCoupleVisible,
    isVendorVisible: !!row.isVendorVisible,
    uploadedByType: row.uploadedByType,
    amount: row.amount ?? null,
    balanceDue: row.balanceDue ?? null,
    signToken: row.signToken ?? null,
    signedAt: row.signedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function workspaceDocKey(docType: string, id: string): string {
  return `${docType}:${id}`;
}
