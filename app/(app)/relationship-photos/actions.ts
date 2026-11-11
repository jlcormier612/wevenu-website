"use server";

import { revalidatePath } from "next/cache";

import {
  removeVenueRelationshipPhoto,
  setVenueRelationshipPhoto,
  useClientRelationshipPhoto,
  useVenueRelationshipPhoto,
} from "@/lib/relationship-photos/service";

function revalidateRelationshipSurfaces(leadId?: string | null, clientId?: string | null) {
  if (leadId) {
    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/edit`);
  }
  if (clientId) {
    revalidatePath(`/clients/${clientId}`);
    revalidatePath(`/clients/${clientId}/edit`);
  }
}

export async function setVenuePhotoAction(
  relationshipId: string,
  url: string,
  opts?: { leadId?: string; clientId?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!relationshipId || !url.trim()) {
    return { ok: false, message: "Missing photo." };
  }
  const result = await setVenueRelationshipPhoto(relationshipId, url.trim());
  if (result.ok) revalidateRelationshipSurfaces(opts?.leadId, opts?.clientId);
  return result;
}

export async function removeVenuePhotoAction(
  relationshipId: string,
  opts?: { leadId?: string; clientId?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!relationshipId) return { ok: false, message: "Missing relationship." };
  const result = await removeVenueRelationshipPhoto(relationshipId);
  if (result.ok) revalidateRelationshipSurfaces(opts?.leadId, opts?.clientId);
  return result;
}

export async function useClientPhotoAction(
  relationshipId: string,
  opts?: { leadId?: string; clientId?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!relationshipId) return { ok: false, message: "Missing relationship." };
  const result = await useClientRelationshipPhoto(relationshipId);
  if (result.ok) revalidateRelationshipSurfaces(opts?.leadId, opts?.clientId);
  return result;
}

export async function useVenuePhotoAction(
  relationshipId: string,
  opts?: { leadId?: string; clientId?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!relationshipId) return { ok: false, message: "Missing relationship." };
  const result = await useVenueRelationshipPhoto(relationshipId);
  if (result.ok) revalidateRelationshipSurfaces(opts?.leadId, opts?.clientId);
  return result;
}
