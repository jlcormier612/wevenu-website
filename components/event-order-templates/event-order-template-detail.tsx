"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  deleteEventOrderTemplateAction,
  duplicateEventOrderTemplateAction,
  updateEventOrderTemplateAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { GuidedSetupWizard } from "@/components/event-order-templates/guided-setup-wizard";
import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { LibrarySaveStatus, useLibrarySaveStatus } from "@/components/library/library-save-status";
import { StarterOwnershipBanner } from "@/components/library/starter-ownership-banner";
import { librarySavedToastMessage, useLibraryUnsavedGuard } from "@/components/library/use-library-unsaved-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";
import type { OfferingWithCategory } from "@/lib/offerings/types";

/** Template-level name / description — no event-type or space columns on this model. */
function EventOrderTemplateDetailsSheet({ template }: { template: EventOrderTemplateWithDetails }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(template.name);
  const [description, setDescription] = React.useState(template.description ?? "");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const dirty = name !== template.name || description !== (template.description ?? "");
  const { confirmLeave } = useLibraryUnsavedGuard(open && dirty);

  function handleSave() {
    startTransition(async () => {
      const result = await updateEventOrderTemplateAction(template.id, { name, description });
      if (result.ok) { setOpen(false); setError(""); toast.success(librarySavedToastMessage()); }
      else setError(result.errors?.name ?? result.message ?? "Could not save.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={(next) => {
      if (!next && dirty && !confirmLeave()) return;
      setOpen(next);
      if (next) {
        setName(template.name);
        setDescription(template.description ?? "");
        setError("");
      }
    }}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="event-order-template-edit-details"
        onClick={() => setOpen(true)}
      >
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        {LIBRARY_LABELS.editDetails}
      </Button>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>{LIBRARY_LABELS.editDetails}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Rename this template and update its description. Event Order templates are not scoped to an
            event type or venue space — apply them from an event when needed. This does not change
            sections, lines, or choice groups.
          </p>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Template name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              data-testid="event-order-template-details-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional"
              data-testid="event-order-template-details-description"
            />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex items-center justify-end gap-2">
          <LibrarySaveStatus status={pending ? "saving" : dirty ? "dirty" : "idle"} model="explicit" className="mr-auto" />
          <Button type="button" variant="outline" onClick={() => { if (confirmLeave()) setOpen(false); }} disabled={pending}>{LIBRARY_LABELS.cancel}</Button>
          <Button
            type="button"
            disabled={!name.trim() || pending || !dirty}
            onClick={handleSave}
            data-testid="event-order-template-details-save"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : LIBRARY_LABELS.saveChanges}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function EventOrderTemplateDetail({
  template, catalogOfferings = [],
}: {
  template: EventOrderTemplateWithDetails;
  catalogOfferings?: OfferingWithCategory[];
}) {
  const router = useRouter();
  const [deleting, startDelete] = React.useTransition();
  const saveUi = useLibrarySaveStatus();
  const isStarter = Boolean(template.sourceMasterKey);

  function onPersist(phase: "saving" | "saved" | "error", message?: string) {
    if (phase === "saving") saveUi.markSaving();
    else if (phase === "saved") saveUi.markSaved();
    else { saveUi.markError(); if (message) toast.error(message); }
  }

  function handleDelete() {
    if (!confirm(`Delete “${template.name}”? This can't be undone. Event Orders already created from it are unaffected.`)) return;
    startDelete(async () => {
      const result = await deleteEventOrderTemplateAction(template.id);
      if (result.ok) { toast.success("Template deleted."); router.push("/library/event-order-templates"); }
      else toast.error(result.message ?? "Could not delete.");
    });
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <BusinessAssetHeader
        backHref="/library/event-order-templates"
        backLabel="Event Order Templates"
        whatIsThis="Event Order Template"
        title={template.name}
        status={
          <>
            {isStarter && !template.isArchived && <Badge variant="muted">{LIBRARY_LABELS.starter}</Badge>}
            {!isStarter && !template.isArchived && <Badge variant="outline">{LIBRARY_LABELS.yourTemplate}</Badge>}
            {template.isArchived ? <Badge variant="muted">{LIBRARY_LABELS.archived}</Badge> : null}
          </>
        }
        lastUpdated={new Date(template.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <LibrarySaveStatus status={saveUi.status} model="autosave" />
            <Button type="button" variant="outline" size="sm" render={<Link href={`/library/event-order-templates/${template.id}/preview`} />}>
              Preview
            </Button>
            <EventOrderTemplateDetailsSheet template={template} />
          </div>
        }
      />

      {isStarter ? (
        <StarterOwnershipBanner
          templateName={template.name}
          itemNoun="sections and offerings"
          customizeHref={(id) => `/library/event-order-templates/${id}`}
          onCustomize={async () => {
            const suggested = template.name.replace(/\s*\(Starter\)\s*$/i, "").trim() || template.name;
            const result = await duplicateEventOrderTemplateAction(
              template.id,
              `${suggested} — ${new Date().getFullYear()}`,
            );
            if (result.ok && result.templateId) {
              return { ok: true as const, templateId: result.templateId };
            }
            return { ok: false as const, message: (result as { message?: string }).message };
          }}
        />
      ) : null}

      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Guided setup asks what you offer, how clients choose, and what each choice reveals — commercial
        category by category. Ordinary configuration stays in the guided steps; specialist selection
        rules are only for unusual cases. Catalog Offerings are linked by id only (never by name).{" "}
        <Link href="/library/offerings" className="font-medium text-heading hover:underline">
          Manage Offerings →
        </Link>
      </p>
      {template.description ? <p className="text-sm text-foreground">{template.description}</p> : null}

      <GuidedSetupWizard
        template={template}
        catalogOfferings={catalogOfferings}
        onPersist={onPersist}
      />

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={deleting} onClick={handleDelete}>
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete Template"}
        </Button>
      </div>
    </div>
  );
}
