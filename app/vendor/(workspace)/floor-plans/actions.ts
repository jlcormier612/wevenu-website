"use server";

/** Sprint 1 — Vendor Event Assets: floor plan sharing. */

import { getVendorFloorPlan, getVendorSharedFloorPlansForEvent } from "@/lib/floor-plans/service";
import type { VendorFloorPlanDetail, VendorFloorPlanSummary } from "@/lib/floor-plans/types";

export async function getVendorSharedFloorPlansForEventAction(eventId: string): Promise<VendorFloorPlanSummary[]> {
  return getVendorSharedFloorPlansForEvent(eventId);
}

export async function getVendorFloorPlanAction(planId: string): Promise<VendorFloorPlanDetail | null> {
  return getVendorFloorPlan(planId);
}
