"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  describeBlockingReferences,
  getVenueDocumentReferences,
  planDocumentDeletion,
} from "@/lib/documents/references";
import * as repo from "@/lib/documents/repository";
import { deleteDocument, saveVenueDocument, updateDocument } from "@/lib/documents/service";
import type {
  CreateDocumentResult,
  DocumentActionResult,
  DocumentUploadPayload,
} from "@/lib/documents/types";
import { getCurrentVenue } from "@/lib/venue/service";

const LIBRARY_PATH = "/library/documents";

/**
 * A Library document is venue-level: every entity key stays null so the file
 * is reusable across the venue rather than belonging to one lead or event.
 * saveVenueDocument already inserts it that way; the entity fields are
 * stripped here so a caller cannot smuggle a scope in.
 */
export async function saveLibraryDocumentAction(
  payload: DocumentUploadPayload,
): Promise<CreateDocumentResult> {
  // Listed field by field rather than spread, so no entityType/entityId can
  // ride along and quietly scope a Library asset to one booking.
  const result = await saveVenueDocument({
    name: payload.name,
    category: payload.category,
    notes: payload.notes,
    tags: payload.tags,
    expiresAt: payload.expiresAt,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    mimeType: payload.mimeType,
    storagePath: payload.storagePath,
    storageUrl: payload.storageUrl,
  });
  if (result.ok) revalidateLibrary();
  return result;
}

/** The list and the landing-page count both move when a document is added or removed. */
function revalidateLibrary() {
  revalidatePath(LIBRARY_PATH);
  revalidatePath("/library");
}

export async function renameLibraryDocumentAction(
  documentId: string,
  name: string,
): Promise<DocumentActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, errors: { name: "Give the document a name." } };

  const owned = await requireLibraryDocument(documentId);
  if (!owned.ok) return owned.result;

  const result = await updateDocument(documentId, { name: trimmed });
  if (result.ok) revalidateLibrary();
  return result;
}

export type LibraryDocumentDeletionInfo =
  | { ok: true; blocked: false; retainStorage: boolean }
  | { ok: true; blocked: true; reason: string }
  | { ok: false; message: string };

/**
 * Asked before the confirmation dialog opens, so the venue is told what is
 * still using a file instead of being handed a failure after confirming.
 */
export async function getLibraryDocumentDeletionInfoAction(
  documentId: string,
): Promise<LibraryDocumentDeletionInfo> {
  const owned = await requireLibraryDocument(documentId);
  if (!owned.ok) return { ok: false, message: owned.result.message ?? "Document not found." };

  try {
    const supabase = await createClient();
    const plan = planDocumentDeletion(
      await getVenueDocumentReferences(supabase, {
        documentId,
        storagePath: owned.storagePath,
      }),
    );
    if (plan.blocked) {
      return {
        ok: true,
        blocked: true,
        reason: `${describeBlockingReferences(plan.blocking)} still use this document.`,
      };
    }
    return { ok: true, blocked: false, retainStorage: plan.retainStorage };
  } catch {
    return { ok: false, message: "Could not check what uses this document." };
  }
}

export async function deleteLibraryDocumentAction(
  documentId: string,
): Promise<DocumentActionResult> {
  const owned = await requireLibraryDocument(documentId);
  if (!owned.ok) return owned.result;

  // Re-checked here rather than trusting the dialog's earlier read — the
  // refusal is a server-side rule, not a UI affordance.
  const info = await getLibraryDocumentDeletionInfoAction(documentId);
  if (!info.ok) return { ok: false, message: info.message };
  if (info.blocked) {
    return {
      ok: false,
      message: `${info.reason} Detach it there first, then delete it here.`,
    };
  }

  // deleteDocument decides on its own whether the storage object survives, so
  // an already-sent message keeps its copy.
  const result = await deleteDocument(documentId);
  if (result.ok) revalidateLibrary();
  return result;
}

type DocumentFailure = Extract<DocumentActionResult, { ok: false }>;

async function requireLibraryDocument(
  documentId: string,
): Promise<
  | { ok: true; storagePath: string | null }
  | { ok: false; result: DocumentFailure }
> {
  if (!isSupabaseConfigured) {
    return { ok: false, result: { ok: false, message: "Backend not configured." } };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, result: { ok: false, message: "No venue found." } };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, result: { ok: false, message: "Session expired." } };

  try {
    const doc = await repo.findVenueDocument(supabase, venue.id, documentId);
    if (!doc) {
      return { ok: false, result: { ok: false, message: "Library document not found." } };
    }
    return { ok: true, storagePath: doc.storagePath };
  } catch {
    return { ok: false, result: { ok: false, message: "Could not load this document." } };
  }
}
