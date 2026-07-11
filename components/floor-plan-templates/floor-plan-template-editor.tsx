"use client";

/**
 * Points the existing Floor Plan editor at a template instead of a
 * booking's floor plan — "template mode" (Floor Plan Template Library
 * task). The editor component itself (components/floor-plan/floor-plan-
 * editor.tsx) is unmodified in behavior; this just supplies template-scoped
 * actions instead of its default booking ones.
 */

import { FloorPlanEditor } from "@/components/floor-plan/floor-plan-editor";
import {
  addTemplateObjectAction, clearTemplateAction, deleteTemplateObjectAction,
  reorderTemplateObjectAction, setTemplateBackgroundLockedAction,
  updateTemplateBackgroundAction, updateTemplateObjectAction, updateTemplateRoomSettingsAction,
} from "@/app/(app)/floor-plan-templates/actions";
import type { FloorPlanCanvasPlan, FloorPlanEditorActions } from "@/lib/floor-plans/types";
import type { InventoryCategory, InventoryItem } from "@/lib/inventory/types";

export function FloorPlanTemplateEditor({
  templateId, venueId, initialPlan, inventoryItems = [], inventoryCategories = [],
}: {
  templateId: string; venueId: string; initialPlan: FloorPlanCanvasPlan;
  inventoryItems?: InventoryItem[]; inventoryCategories?: InventoryCategory[];
}) {
  const actions: FloorPlanEditorActions = {
    // Never invoked — the template row always exists before this page can
    // render (it's created up front by the New Template flow).
    create: async () => ({ ok: true }),
    addObject: (planId, input) => addTemplateObjectAction(planId, input),
    updateObject: (objId, input) => updateTemplateObjectAction(objId, input),
    deleteObject: (objId) => deleteTemplateObjectAction(objId, templateId),
    reorderObject: (planId, objId, direction) => reorderTemplateObjectAction(planId, objId, direction),
    updateBackground: (planId, url, opacity) => updateTemplateBackgroundAction(planId, url, opacity),
    setBackgroundLocked: (planId, locked) => setTemplateBackgroundLockedAction(planId, locked),
    updateRoomSettings: (planId, input) => updateTemplateRoomSettingsAction(planId, input),
    clear: (planId) => clearTemplateAction(planId),
  };

  return (
    <FloorPlanEditor
      initialPlan={initialPlan}
      venueId={venueId}
      actions={actions}
      showPrint={false}
      inventoryItems={inventoryItems}
      inventoryCategories={inventoryCategories}
    />
  );
}
