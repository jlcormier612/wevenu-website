"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  activateLegalDocumentVersion,
  createLegalDocumentVersion,
  deactivateLegalDocumentVersion,
} from "@/lib/legal/service";
import { PUBLIC_LEGAL_PATH_BY_TYPE } from "@/lib/legal/public-routes";
import type {
  CreateLegalDocumentVersionInput,
  LegalDocumentType,
} from "@/lib/legal/types";

function revalidateLegalPaths(documentType?: string, id?: string) {
  revalidatePath("/admin/legal");
  if (documentType) {
    revalidatePath(`/admin/legal/${documentType}`);
    revalidatePath(`/legal/${documentType}`);
    const publicPath =
      PUBLIC_LEGAL_PATH_BY_TYPE[documentType as LegalDocumentType];
    if (publicPath) revalidatePath(publicPath);
  }
  if (documentType && id) {
    revalidatePath(`/admin/legal/${documentType}/${id}`);
  }
}

export async function createLegalVersionAction(
  input: CreateLegalDocumentVersionInput,
) {
  const result = await createLegalDocumentVersion(input);
  if (result.ok) {
    revalidateLegalPaths(input.documentType, result.id);
    redirect(`/admin/legal/${input.documentType}/${result.id}`);
  }
  return result;
}

export async function activateLegalVersionAction(
  id: string,
  documentType: string,
) {
  const result = await activateLegalDocumentVersion(id);
  if (result.ok) {
    revalidateLegalPaths(documentType, id);
  }
  return result;
}

export async function deactivateLegalVersionAction(
  id: string,
  documentType: string,
) {
  const result = await deactivateLegalDocumentVersion(id);
  if (result.ok) {
    revalidateLegalPaths(documentType, id);
  }
  return result;
}
