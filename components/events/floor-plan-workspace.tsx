"use client";

/**
 * Booking → Floor Plans. A booking may hold many floor plans (Ceremony,
 * Reception, Cocktail Hour, Rain Backup, ...) — this is the workspace the
 * venue lands on first, a card grid, not immediately the editor (Booking
 * Floor Plan Workspace task). Opening a card reuses the existing Floor Plan
 * editor unmodified, now scoped to that one plan's own id.
 *
 * "+ New Floor Plan" only ever creates a booking-specific layout — Apply
 * Template, Duplicate Existing Floor Plan, or Blank. Templates themselves
 * are built elsewhere (the Floor Plan Template Library); this flow only
 * ever reads from them, never rebuilds them.
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  applyTemplateAction, createFloorPlanAction, deleteFloorPlanAction, duplicateFloorPlanAction,
  renameFloorPlanAction, setClientAccessAction,
} from "@/app/(app)/events/[id]/floor-plan-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VenueSpace } from "@/lib/availability/types";
import type { FloorPlan } from "@/lib/floor-plans/types";
import type { FloorPlanTemplate } from "@/lib/floor-plan-templates/types";
import type { InventoryUsage } from "@/lib/inventory/types";

const NO_SPACE = "__none__";

type Method = "apply" | "duplicate" | "blank";

function spaceName(spaces: VenueSpace[], spaceId: string | null): string | null {
  return spaceId ? spaces.find((s) => s.id === spaceId)?.name ?? null : null;
}

/**
 * Seating Experience — Phase 1 resolves its one Floor Plan by
 * clientAccess != 'hidden'. This toggle is the only UI that ever sets it —
 * sharing here is what makes a Floor Plan's tables available to the
 * couple's Seating experience at all.
 */
function ShareForSeatingToggle({ eventId, plan }: { eventId: string; plan: FloorPlan }) {
  const router = useRouter();
  const [access, setAccess] = React.useState(plan.clientAccess);
  const [pending, startTransition] = React.useTransition();
  const shared = access !== "hidden";

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = shared ? "hidden" : "view";
    startTransition(async () => {
      const result = await setClientAccessAction(plan.id, eventId, next);
      if (result.ok) { setAccess(next); router.refresh(); }
      else toast.error(result.message ?? "Could not update sharing.");
    });
  }

  return (
    <Tooltip>
      <TooltipTrigger render={
        <button type="button" onClick={toggle} disabled={pending}
          className={`self-start text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
            shared ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
          }`}>
          {pending ? "…" : shared ? "Shared for Seating" : "Share for Seating"}
        </button>
      } />
      <TooltipContent>
        {shared ? "Visible to the couple — tables here are available in Seating. Click to unshare." : "Not visible to the couple yet. Click to share for Seating."}
      </TooltipContent>
    </Tooltip>
  );
}

function FloorPlanCard({
  eventId, plan, spaces, busy, onRename, onDelete,
}: {
  eventId: string; plan: FloorPlan; spaces: VenueSpace[]; busy: boolean;
  onRename: () => void; onDelete: () => void;
}) {
  return (
    <Link
      href={`/events/${eventId}/floor-plans/${plan.id}`}
      className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-heading">{plan.name}</p>
        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} aria-label="Floor plan actions" />}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{spaceName(spaces, plan.spaceId) ?? "No space assigned"}</p>
      <ShareForSeatingToggle eventId={eventId} plan={plan} />
    </Link>
  );
}

export function FloorPlanWorkspace({
  eventId, floorPlans, templates, spaces, eventSpaceId, inventoryUsage = [],
}: {
  eventId: string;
  floorPlans: FloorPlan[];
  templates: FloorPlanTemplate[];
  spaces: VenueSpace[];
  eventSpaceId: string | null;
  /** Reporting only (Inventory Foundation task) — never blocks or reserves anything. */
  inventoryUsage?: InventoryUsage[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [method, setMethod] = React.useState<Method>("blank");
  const [name, setName] = React.useState("");
  const [spaceId, setSpaceId] = React.useState(eventSpaceId ?? NO_SPACE);
  const [templateId, setTemplateId] = React.useState("");
  const [sourcePlanId, setSourcePlanId] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [busyPlanId, setBusyPlanId] = React.useState<string | null>(null);

  function reset() {
    setMethod("blank"); setName(""); setSpaceId(eventSpaceId ?? NO_SPACE); setTemplateId(""); setSourcePlanId("");
  }

  function handleRenamePlan(plan: FloorPlan) {
    const next = window.prompt("Rename floor plan", plan.name);
    if (!next || !next.trim() || next.trim() === plan.name) return;
    setBusyPlanId(plan.id);
    startTransition(async () => {
      const result = await renameFloorPlanAction(plan.id, eventId, next.trim());
      setBusyPlanId(null);
      if (result.ok) { toast.success("Floor plan renamed."); router.refresh(); }
      else toast.error(result.message ?? "Could not rename floor plan.");
    });
  }

  function handleDeletePlan(plan: FloorPlan) {
    if (!confirm(`Delete "${plan.name}"? This removes every object on it and can't be undone.`)) return;
    setBusyPlanId(plan.id);
    startTransition(async () => {
      const result = await deleteFloorPlanAction(plan.id, eventId);
      setBusyPlanId(null);
      if (result.ok) { toast.success("Floor plan deleted."); router.refresh(); }
      else toast.error(result.message ?? "Could not delete floor plan.");
    });
  }

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      if (!name.trim()) setName(t.name);
      setSpaceId(t.spaceId ?? eventSpaceId ?? NO_SPACE);
    }
  }

  function handleSourceChange(id: string) {
    setSourcePlanId(id);
    const p = floorPlans.find((x) => x.id === id);
    if (p) {
      if (!name.trim()) setName(`${p.name} (Copy)`);
      setSpaceId(p.spaceId ?? NO_SPACE);
    }
  }

  function handleSubmit() {
    if (!name.trim()) return;
    if (method === "apply" && !templateId) return;
    if (method === "duplicate" && !sourcePlanId) return;
    const resolvedSpaceId = spaceId === NO_SPACE ? null : spaceId;

    startTransition(async () => {
      const result = method === "apply"
        ? await applyTemplateAction(eventId, templateId, name.trim(), resolvedSpaceId)
        : method === "duplicate"
          ? await duplicateFloorPlanAction(eventId, sourcePlanId, name.trim(), resolvedSpaceId)
          : await createFloorPlanAction(eventId, name.trim(), resolvedSpaceId);

      if (result.ok) {
        setOpen(false);
        reset();
        router.push(`/events/${eventId}/floor-plans/${result.floorPlanId}`);
      } else {
        toast.error(result.message ?? "Could not create floor plan.");
      }
    });
  }

  const canSubmit = !!name.trim() && (method !== "apply" || !!templateId) && (method !== "duplicate" || !!sourcePlanId);
  const submitLabel = method === "apply" ? "Apply" : method === "duplicate" ? "Duplicate" : "Create Floor Plan";

  // Seating always resolves to exactly one shared plan (whichever was most
  // recently updated) — a coordinator who shares more than one at once has
  // no other signal telling them which one the couple is actually seeing.
  const sharedPlans = floorPlans.filter((p) => p.clientAccess !== "hidden");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => { reset(); setOpen(true); }}>+ New Floor Plan</Button>
      </div>

      {sharedPlans.length > 1 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          {sharedPlans.length} floor plans are shared for Seating at once — the couple only ever sees the most recently
          updated one ({[...sharedPlans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0].name}). Unshare the
          others if that&apos;s not the one they should be seating against.
        </div>
      )}

      {floorPlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm font-medium text-heading">No floor plans yet</p>
          <p className="text-xs text-muted-foreground">Apply a template, duplicate another booking&apos;s plan, or start from a blank room.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {floorPlans.map((plan) => (
            <FloorPlanCard
              key={plan.id} eventId={eventId} plan={plan} spaces={spaces}
              busy={busyPlanId === plan.id}
              onRename={() => handleRenamePlan(plan)}
              onDelete={() => handleDeletePlan(plan)}
            />
          ))}
        </div>
      )}

      {inventoryUsage.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inventory Usage</p>
          <ul className="space-y-1">
            {inventoryUsage.map((u) => {
              const remaining = u.quantityAvailable - u.quantityUsed;
              return (
                <li key={u.itemId} className={`flex items-center justify-between text-sm ${remaining < 0 ? "text-destructive" : ""}`}>
                  <span className={remaining < 0 ? "" : "text-foreground"}>{u.name}</span>
                  <span className={remaining < 0 ? "" : "text-muted-foreground"}>
                    {u.quantityUsed} used · {u.quantityAvailable} available · {remaining} remaining
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>How would you like to start?</SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)}>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="apply" disabled={templates.length === 0} />
                Apply Template
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="duplicate" disabled={floorPlans.length === 0} />
                Duplicate Existing Floor Plan
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="blank" />
                Blank Floor Plan
              </label>
            </RadioGroup>

            {method === "apply" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Template</Label>
                <Select value={templateId} onValueChange={handleTemplateChange} items={templates.map((t) => ({ value: t.id, label: t.name }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose a template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {method === "duplicate" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Existing floor plan</Label>
                <Select value={sourcePlanId} onValueChange={handleSourceChange} items={floorPlans.map((p) => ({ value: p.id, label: p.name }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose a floor plan" /></SelectTrigger>
                  <SelectContent>
                    {floorPlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Floor Plan Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reception" className="h-9 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Venue Space (optional if inherited)</Label>
              <Select value={spaceId} onValueChange={setSpaceId} items={[{ value: NO_SPACE, label: "No specific space" }, ...spaces.map((s) => ({ value: s.id, label: s.name }))]}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SPACE}>No specific space</SelectItem>
                  {spaces.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={pending}>Cancel</Button>
            <Button type="button" disabled={!canSubmit || pending} onClick={handleSubmit}>
              {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : submitLabel}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
