import type { DocumentCategory } from "@/lib/documents/types";

export type VendorLibraryDocument = {
  id: string;
  name: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string;
  storageUrl: string;
  category: DocumentCategory;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type VendorEventUpload = {
  id: string;
  name: string;
  category: string;
  storageUrl: string;
  mimeType: string | null;
  notes: string | null;
  isCoupleVisible?: boolean;
  createdAt?: string;
};

export type VendorUploadedByEvent = {
  assignmentId: string;
  eventId: string;
  eventName: string;
  eventDate: string | null;
  venueName: string;
  documents: VendorEventUpload[];
};

export type VendorDocumentActionResult =
  | { ok: true; documentId?: string }
  | { ok: false; message?: string };
