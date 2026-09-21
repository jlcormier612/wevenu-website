"use server";

import { revalidatePath } from "next/cache";

import {
  addClientEntry,
  addClientSection,
} from "@/lib/timeline/service";
import { applyTimelineTemplateToClient } from "@/lib/timeline-templates/apply";
import { applyClientStarterTemplate } from "@/lib/timeline/service";
import {
  applyTemplateForClient,
  createFloorPlanForClient,
  duplicateFloorPlanForClient,
} from "@/lib/floor-plans/service";
import { ensureEventOrderForClient } from "@/lib/event-orders/service";
import { assignVendorToClient } from "@/lib/vendors/service";
import type { TimelineEntryInput, AddEntryResult, AddSectionResult, TimelineActionResult } from "@/lib/timeline/types";
import type { CreateFloorPlanResult } from "@/lib/floor-plans/types";
import type { EnsureEventOrderResult } from "@/lib/event-orders/types";
import type { TemplateApplySelection } from "@/lib/event-order-templates/offerings";
import type { VendorAssignmentInput, VendorActionResult, EventVendorAssignment } from "@/lib/vendors/types";

function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
}

export async function addClientTimelineEntryAction(
  clientId: string, input: TimelineEntryInput,
): Promise<AddEntryResult> {
  const result = await addClientEntry(clientId, input);
  if (result.ok) refresh(clientId);
  return result;
}

export async function addClientTimelineSectionAction(
  clientId: string, name: string, sortOrder: number,
): Promise<AddSectionResult> {
  const result = await addClientSection(clientId, name, sortOrder);
  if (result.ok) refresh(clientId);
  return result;
}

export async function applyClientStarterTimelineAction(
  clientId: string, templateId: string, startTime: string | null,
): Promise<TimelineActionResult> {
  const result = await applyClientStarterTemplate(clientId, templateId, startTime);
  if (result.ok) refresh(clientId);
  return result;
}

export async function applyClientTimelineTemplateAction(
  clientId: string, templateId: string, startTime: string | null,
): Promise<TimelineActionResult> {
  const result = await applyTimelineTemplateToClient(clientId, templateId, startTime);
  if (result.ok) refresh(clientId);
  return result;
}

export async function createClientFloorPlanAction(
  clientId: string, name?: string, spaceId?: string | null,
): Promise<CreateFloorPlanResult> {
  const result = await createFloorPlanForClient(clientId, name, spaceId ?? null);
  if (result.ok) refresh(clientId);
  return result;
}

export async function applyClientFloorPlanTemplateAction(
  clientId: string, templateId: string, name: string, spaceId: string | null,
): Promise<CreateFloorPlanResult> {
  const result = await applyTemplateForClient(clientId, templateId, name, spaceId);
  if (result.ok) refresh(clientId);
  return result;
}

export async function duplicateClientFloorPlanAction(
  clientId: string, sourceFloorPlanId: string, name: string, spaceId: string | null,
): Promise<CreateFloorPlanResult> {
  const result = await duplicateFloorPlanForClient(clientId, sourceFloorPlanId, name, spaceId);
  if (result.ok) refresh(clientId);
  return result;
}

export async function ensureClientEventOrderAction(
  clientId: string, templateId: string | null, selections?: TemplateApplySelection[],
): Promise<EnsureEventOrderResult> {
  const result = await ensureEventOrderForClient(clientId, templateId, selections);
  if (result.ok) refresh(clientId);
  return result;
}

export async function assignVendorToClientAction(
  clientId: string, input: VendorAssignmentInput,
): Promise<{ ok: true; assignment: EventVendorAssignment } | VendorActionResult> {
  const result = await assignVendorToClient(clientId, input);
  if (result.ok) refresh(clientId);
  return result;
}
