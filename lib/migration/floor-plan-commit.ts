/**
 * Commit a Migration Center floor_plan record into canonical Documents +
 * optional template / event floor plan (Phase 2 background_document_id).
 * No vectorization — layout objects are never invented from the file.
 */
import type { AnyDbClient } from "@/lib/lead-intake/types";
import * as documentsRepo from "@/lib/documents/repository";
import * as floorPlansRepo from "@/lib/floor-plans/repository";
import * as templatesRepo from "@/lib/floor-plan-templates/repository";
import {
  buildNormalizedFloorPlanImport,
  type NormalizedFloorPlanImport,
} from "@/lib/migration/floor-plan-import";

export async function commitFloorPlanImport(
  client: AnyDbClient,
  venueId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; entityId: string } | { ok: false; error: string }> {
  const n = buildNormalizedFloorPlanImport(payload as Parameters<typeof buildNormalizedFloorPlanImport>[0]);
  if (!n.storagePath || !n.storageUrl || !n.fileName) {
    return { ok: false, error: "Floor plan files need storagePath, storageUrl, and fileName." };
  }

  const renderUrl = n.renderableImageUrl
    ?? (n.mimeType?.startsWith("image/") ? n.storageUrl : null);

  if (n.scope === "general_reference") {
    const documentId = await documentsRepo.insertVenueDocument(client as never, venueId, {
      name: n.name,
      category: "floor_plan",
      notes: n.notes?.trim()
        || "Imported via Bring Your Business — floor plan reference file.",
      tags: "migration,floor_plan",
      expiresAt: "",
      fileName: n.fileName,
      fileSize: n.fileSize ? Number(n.fileSize) : 0,
      mimeType: n.mimeType ?? "application/octet-stream",
      storagePath: n.storagePath,
      storageUrl: n.storageUrl,
    });
    return { ok: true, entityId: documentId };
  }

  if (n.scope === "space_master") {
    if (!n.spaceId) return { ok: false, error: "Space master imports need a Space." };
    const documentId = await documentsRepo.insertVenueDocument(client as never, venueId, {
      name: n.name,
      category: "floor_plan",
      notes: n.notes?.trim()
        || "Imported via Bring Your Business — Space master floor plan.",
      tags: "migration,floor_plan,space_master",
      expiresAt: "",
      fileName: n.fileName,
      fileSize: n.fileSize ? Number(n.fileSize) : 0,
      mimeType: n.mimeType ?? "application/octet-stream",
      storagePath: n.storagePath,
      storageUrl: n.storageUrl,
    });
    const templateId = await templatesRepo.insertTemplate(
      client as never, venueId, n.name, null, n.spaceId,
    );
    await templatesRepo.updateBackground(
      client as never, venueId, templateId, renderUrl, 0.5, documentId,
    );
    return { ok: true, entityId: documentId };
  }

  // event_specific
  if (!n.eventId) return { ok: false, error: "Event-specific imports need an Event." };
  const documentId = await documentsRepo.insertDocument(client as never, venueId, {
    entityType: "event",
    entityId: n.eventId,
    name: n.name,
    category: "floor_plan",
    notes: n.notes?.trim()
      || "Imported via Bring Your Business — event floor plan.",
    tags: "migration,floor_plan,event",
    expiresAt: "",
    fileName: n.fileName,
    fileSize: n.fileSize ? Number(n.fileSize) : 0,
    mimeType: n.mimeType ?? "application/octet-stream",
    storagePath: n.storagePath,
    storageUrl: n.storageUrl,
  });
  const planId = await floorPlansRepo.createFloorPlan(
    client as never, venueId, n.eventId, n.name, n.spaceId,
  );
  await floorPlansRepo.updateFloorPlanBackground(
    client as never, venueId, planId, renderUrl, 0.5, documentId,
  );
  return { ok: true, entityId: documentId };
}

export type { NormalizedFloorPlanImport };
