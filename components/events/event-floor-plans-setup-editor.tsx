"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  ensureEventFloorPlanOffersAction,
  updateFloorPlanOfferAction,
  upsertFloorPlanOfferAction,
  withdrawFloorPlanOfferAction,
} from "@/app/(app)/events/[id]/floor-plan-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import type { EventFloorPlanOfferWithTemplate } from "@/lib/floor-plan-offers/types";
import type { FloorPlanTemplate } from "@/lib/floor-plan-templates/types";

type OperationalPlanSummary = {
  id: string;
  name: string;
};

export function EventFloorPlansSetupEditor({
  open,
  onOpenChange,
  eventId,
  eventName,
  profileName,
  preferredTemplateId,
  configuredTemplateIds,
  templates,
  offers,
  operationalPlans,
  onOpenManagement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  profileName: string | null;
  preferredTemplateId: string | null;
  configuredTemplateIds: string[];
  templates: FloorPlanTemplate[];
  offers: EventFloorPlanOfferWithTemplate[];
  operationalPlans: OperationalPlanSummary[];
  onOpenManagement: () => void;
}) {
  const router = useRouter();
  const activeTemplates = templates.filter((t) => !t.isArchived);
  const offeredTemplateIds = new Set(offers.filter((o) => o.isOffered).map((o) => o.floorPlanTemplateId));
  const availableToOffer = activeTemplates.filter((t) => !offeredTemplateIds.has(t.id));

  const [templateId, setTemplateId] = React.useState("");
  const [coupleLabel, setCoupleLabel] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [ensuring, setEnsuring] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTemplateId("");
    setCoupleLabel("");
  }, [open, offers]);

  // Recover missing offers from Setup Profile snapshot — idempotent; does not create operational plans.
  React.useEffect(() => {
    if (!open || offers.length > 0) return;
    const ids = new Set(configuredTemplateIds.filter(Boolean));
    if (preferredTemplateId) ids.add(preferredTemplateId);
    if (ids.size === 0) return;
    let cancelled = false;
    setEnsuring(true);
    void (async () => {
      const result = await ensureEventFloorPlanOffersAction(
        eventId,
        [...ids],
        preferredTemplateId,
      );
      if (cancelled) return;
      setEnsuring(false);
      if (!result.ok) {
        toast.error(result.message ?? "Could not recover floor-plan offers for this event.");
      } else {
        router.refresh();
      }
    })();
    return () => { cancelled = true; };
  }, [open, offers.length, configuredTemplateIds, preferredTemplateId, eventId, router]);

  const preferredName =
    (preferredTemplateId
      && (offers.find((o) => o.floorPlanTemplateId === preferredTemplateId)?.templateName
        ?? activeTemplates.find((t) => t.id === preferredTemplateId)?.name))
    || null;

  function requestClose() {
    if (pending) return;
    onOpenChange(false);
  }

  function offerTemplate() {
    if (!templateId) {
      toast.error("Choose a floor-plan layout to offer.");
      return;
    }
    startTransition(async () => {
      const result = await upsertFloorPlanOfferAction(eventId, {
        templateId,
        isOffered: true,
        coupleLabel: coupleLabel.trim() || null,
        sortOrder: offers.length,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not offer layout for this event.");
        return;
      }
      setTemplateId("");
      setCoupleLabel("");
      toast.success("Layout offered for this event only. Library templates were not changed.");
      router.refresh();
    });
  }

  function withdraw(offerId: string, label: string) {
    if (!confirm(`Withdraw "${label}" from this event's couple chooser?\n\nDoes not delete operational floor plans or Library templates.`)) {
      return;
    }
    startTransition(async () => {
      const result = await withdrawFloorPlanOfferAction(eventId, offerId);
      if (!result.ok) {
        toast.error(result.message ?? "Could not withdraw offer.");
        return;
      }
      toast.success("Offer withdrawn for this event.");
      router.refresh();
    });
  }

  function reoffer(offerId: string) {
    startTransition(async () => {
      const result = await updateFloorPlanOfferAction(eventId, offerId, { isOffered: true });
      if (!result.ok) {
        toast.error(result.message ?? "Could not offer layout again.");
        return;
      }
      toast.success("Layout offered again for this event.");
      router.refresh();
    });
  }

  function openManagement() {
    onOpenChange(false);
    onOpenManagement();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) requestClose(); else onOpenChange(true); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
        data-testid="event-floor-plans-setup-editor"
      >
        <SheetHeader className="mb-4">
          <SheetTitle>Edit floor-plan offers for this event</SheetTitle>
          <SheetDescription>
            {eventName}
            {profileName ? ` · from ${profileName}` : ""}
            . Choose which reusable layouts the client can pick from for this event.
            Offers are not operational floor plans. Creating or editing layouts stays in Open Floor Plans.
            This does not release to the client portal.
          </SheetDescription>
        </SheetHeader>

        <div
          className="mb-4 rounded-md border border-border bg-muted/20 px-3 py-3 space-y-1"
          data-testid="floor-plans-setup-operational-state"
        >
          <p className="text-sm font-medium text-heading">Operational floor plans for this booking</p>
          {operationalPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None yet. Offers can exist without an operational layout. Use Open Floor Plans to create
              or edit the venue&apos;s working layout for this event.
            </p>
          ) : (
            <ul className="text-sm text-muted-foreground list-disc pl-4">
              {operationalPlans.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            data-testid="floor-plans-setup-open-management"
            onClick={openManagement}
          >
            Open Floor Plans
          </Button>
        </div>

        {ensuring ? (
          <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Recovering this event&apos;s floor-plan offers…
          </p>
        ) : null}

        <div className="space-y-3" data-testid="floor-plans-setup-offers-path">
          <div>
            <p className="text-sm font-medium text-heading">Layouts offered to the client</p>
            <p className="text-xs text-muted-foreground mt-1">
              Preferred starting from profile
              {preferredName ? `: ${preferredName}` : " (none set)"}.
              Changes here update this event&apos;s offers only — not Library templates or other events.
            </p>
          </div>

          {offers.length === 0 && !ensuring ? (
            <p className="text-sm text-muted-foreground" data-testid="floor-plans-setup-no-offers">
              {configuredTemplateIds.length > 0 || preferredTemplateId
                ? "No offers on this event yet. Recovery runs automatically when a Setup Profile starting set exists; you can also offer a layout below."
                : "No floor-plan offers are configured for this event. Offer a Library layout below, or open Setup Profiles if this area should use a standard starting set."}
            </p>
          ) : (
            <ul className="space-y-2">
              {offers.map((o) => {
                const label = o.coupleLabel?.trim() || o.templateName;
                const isPreferred = Boolean(preferredTemplateId && o.floorPlanTemplateId === preferredTemplateId);
                return (
                  <li
                    key={o.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                    data-testid={`floor-plans-setup-offer-${o.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-heading truncate">
                        {label}
                        {!o.isOffered ? (
                          <span className="ml-2 text-[10px] font-medium text-muted-foreground">(withdrawn)</span>
                        ) : null}
                        {isPreferred ? (
                          <span className="ml-2 text-[10px] font-medium text-muted-foreground">(preferred start)</span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Template: {o.templateName} · {o.objectCount} elements
                      </p>
                    </div>
                    <div className="shrink-0">
                      {o.isOffered ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          data-testid={`floor-plans-setup-withdraw-${o.id}`}
                          onClick={() => withdraw(o.id, label)}
                        >
                          Withdraw
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending || o.templateArchived}
                          onClick={() => reoffer(o.id)}
                        >
                          Offer again
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="rounded-md border border-dashed border-border p-3 space-y-2">
            <p className="text-sm font-medium text-heading">Offer another layout for this event</p>
            <Select
              value={templateId}
              onValueChange={setTemplateId}
              items={availableToOffer.map((t) => ({ value: t.id, label: t.name }))}
            >
              <SelectTrigger data-testid="floor-plans-setup-template-select">
                <SelectValue placeholder="Choose a Library layout" />
              </SelectTrigger>
              <SelectContent>
                {availableToOffer.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Couple label (optional)"
              value={coupleLabel}
              disabled={pending}
              data-testid="floor-plans-setup-couple-label"
              onChange={(e) => setCoupleLabel(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              disabled={pending || !templateId || availableToOffer.length === 0}
              data-testid="floor-plans-setup-offer"
              onClick={offerTemplate}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
              Offer for this event
            </Button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={pending}>
            Back to Overview
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
