export type DocumentCategory =
  | "contract"
  | "insurance"
  | "inspiration"
  | "floor_plan"
  | "menu"
  | "permit"
  | "questionnaire"
  | "invoice_copy"
  | "other";

export type DocumentEntityType = "lead" | "client" | "event" | "vendor";

export type Document = {
  id: string;
  venueId: string;
  leadId: string | null;
  clientId: string | null;
  eventId: string | null;
  vendorId: string | null;
  name: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string;
  storageUrl: string;
  category: DocumentCategory;
  notes: string | null;
  tags: string[];
  expiresAt: string | null;   // ISO date "YYYY-MM-DD"
  createdAt: string;
  updatedAt: string;
};

export type DocumentInput = {
  name: string;
  category: DocumentCategory;
  notes: string;
  tags: string;        // comma-separated, parsed on save
  expiresAt: string;   // ISO date or empty
};

export type DocumentErrors = Record<string, string>;

export type DocumentActionResult =
  | { ok: true }
  | { ok: false; errors?: DocumentErrors; message?: string };

export type CreateDocumentResult =
  | { ok: true; documentId: string }
  | { ok: false; errors?: DocumentErrors; message?: string };

// What the client uploads — used in the client component before hitting the server action
export type DocumentUploadPayload = {
  entityType: DocumentEntityType;
  entityId: string;
  name: string;
  category: DocumentCategory;
  notes: string;
  tags: string;
  expiresAt: string;
  // Set by the client after uploading to storage
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  storageUrl: string;
};
