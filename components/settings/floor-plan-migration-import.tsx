"use client";

/**
 * Migration Center — Floor Plan Phase 3 batch import.
 * Reuses session → normalize → match → review → commit. Does not invent a
 * parallel import system. ZIP expands client-side; originals land as Documents.
 */

import * as React from "react";

import { Loader2, MapPinned, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  addMigrationRowsAction,
  getFloorPlanImportCatalogAction,
  resolveFloorPlanImportRecordAction,
  reviewMigrationRecordAction,
  runMigrationDedupeAction,
  startMigrationSessionAction,
} from "@/app/(app)/settings/migration-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/integrations/supabase/client";
import { prepareFloorPlanSourceUpload } from "@/lib/floor-plans/client-background-upload";
import {
  proposeFloorPlanScopeFromFileName,
  type FloorPlanImportScope,
  type FloorPlanMatchCandidate,
} from "@/lib/migration/floor-plan-import";
import { collectFloorPlanUploadFiles } from "@/lib/migration/floor-plan-zip";
import type { MigrationRecord, SourceKey } from "@/lib/migration/types";

const SCOPE_LABEL: Record<FloorPlanImportScope, string> = {
  space_master: "Space master",
  event_specific: "Event-specific",
  general_reference: "General reference",
};

type PendingRow = {
  sourceRef: string;
  name: string;
  fileName: string;
  storagePath: string;
  storageUrl: string;
  renderableImageUrl: string;
  mimeType: string;
  fileSize: string;
  scope: FloorPlanImportScope;
  spaceId: string | null;
  spaceName: string | null;
  eventId: string | null;
  eventName: string | null;
  eventDate: string | null;
  sourceId: string;
};

export function FloorPlanMigrationImport({
  venueId,
  sourceKey,
  onSessionReady,
  floorPlanRecords = [],
  activeSessionId,
}: {
  venueId: string;
  sourceKey: SourceKey;
  onSessionReady: (sessionId: string) => void;
  floorPlanRecords?: MigrationRecord[];
  activeSessionId?: string | null;
}) {
  const [working, setWorking] = React.useState(false);
  const [spaces, setSpaces] = React.useState<FloorPlanMatchCandidate[]>([]);
  const [events, setEvents] = React.useState<FloorPlanMatchCandidate[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    void getFloorPlanImportCatalogAction().then((c) => {
      setSpaces(c.spaces);
      setEvents(c.events);
    });
  }, []);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    if (!picked?.length) return;
    setWorking(true);
    try {
      const { files, skippedNonFloorPlan } = await collectFloorPlanUploadFiles(picked);
      if (files.length === 0) {
        toast.error(
          skippedNonFloorPlan > 0
            ? "No PDF or image floor plans found in that selection."
            : "Choose PDF or image floor plans (or a ZIP of them).",
        );
        return;
      }

      const spaceNames = spaces.map((s) => s.name);
      const rows: PendingRow[] = [];
      for (const item of files) {
        const prepared = await prepareFloorPlanSourceUpload({
          venueId,
          planId: crypto.randomUUID(),
          file: item.file,
        });
        const proposal = proposeFloorPlanScopeFromFileName(item.fileName, spaceNames);
        const spaceHit = proposal.spaceName
          ? spaces.find((s) => s.name === proposal.spaceName) ?? null
          : null;
        rows.push({
          sourceRef: item.sourceRef,
          name: prepared.displayName,
          fileName: prepared.fileName,
          storagePath: prepared.storagePath,
          storageUrl: prepared.storageUrl,
          renderableImageUrl: prepared.renderableImageUrl,
          mimeType: prepared.mimeType,
          fileSize: String(prepared.fileSize),
          scope: proposal.scope,
          spaceId: spaceHit?.id ?? null,
          spaceName: proposal.spaceName,
          eventId: null,
          eventName: null,
          eventDate: proposal.eventDate,
          sourceId: prepared.storagePath,
        });
      }

      const started = await startMigrationSessionAction(sourceKey);
      if (!started.ok) {
        toast.error(started.message);
        return;
      }

      // Retain the batch ZIP/files as session source artifacts when a single ZIP was used.
      for (const f of Array.from(picked)) {
        if (f.name.toLowerCase().endsWith(".zip") || f.type.includes("zip")) {
          const supabase = createClient();
          const docId = crypto.randomUUID();
          const path = `migration/${started.session.id}/${docId}.zip`;
          await supabase.storage.from("documents").upload(path, f, { upsert: false, contentType: f.type || "application/zip" });
          const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
          const { attachMigrationSourceFileAction } = await import("@/app/(app)/settings/migration-actions");
          await attachMigrationSourceFileAction(started.session.id, {
            fileName: f.name, fileSize: f.size, mimeType: f.type || "application/zip",
            storagePath: path, storageUrl: urlData.publicUrl,
          });
        }
      }

      const added = await addMigrationRowsAction(
        started.session.id,
        "floor_plan",
        rows.map((r) => ({
          ...r,
          sourceRowRef: r.sourceRef,
        })),
      );
      if (!added.ok) {
        toast.error(added.message);
        return;
      }
      const deduped = await runMigrationDedupeAction(started.session.id);
      if (!deduped.ok) {
        toast.error(deduped.message);
        return;
      }
      toast.success(
        `${rows.length} floor plan${rows.length === 1 ? "" : "s"} ready for review`
        + (skippedNonFloorPlan ? ` (${skippedNonFloorPlan} other file${skippedNonFloorPlan === 1 ? "" : "s"} skipped)` : "")
        + ".",
      );
      onSessionReady(started.session.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import those floor plans.");
    } finally {
      setWorking(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const needsAttention = floorPlanRecords.filter((r) =>
    r.status === "needs_review" || r.status === "duplicate_likely" || r.status === "conflict",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPinned className="h-4 w-4" />
          Floor plans
        </CardTitle>
        <CardDescription>
          Upload floor plan PDFs or images — one file or a ZIP of many. We keep each original as your floor plan file,
          match Space or Event when we can, and ask you to review anything ambiguous. Layout objects are not auto-drawn.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Floor plan files or ZIP</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={working} onClick={() => fileRef.current?.click()}>
              {working ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
              {working ? "Uploading…" : "Choose files"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.zip,application/zip"
              className="sr-only"
              onChange={handleFilesSelected}
            />
            <p className="text-xs text-muted-foreground">PDF, PNG, JPG, WebP, GIF, SVG, or ZIP</p>
          </div>
        </div>

        {activeSessionId && needsAttention.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Floor plans needing a match</p>
            {needsAttention.map((r) => (
              <FloorPlanReviewRow
                key={r.id}
                record={r}
                sessionId={activeSessionId}
                spaces={spaces}
                events={events}
                onResolved={() => onSessionReady(activeSessionId)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FloorPlanReviewRow({
  record,
  sessionId,
  spaces,
  events,
  onResolved,
}: {
  record: MigrationRecord;
  sessionId: string;
  spaces: FloorPlanMatchCandidate[];
  events: FloorPlanMatchCandidate[];
  onResolved: () => void;
}) {
  const p = record.normalizedPayload ?? {};
  const [scope, setScope] = React.useState<FloorPlanImportScope>(
    (p.scope as FloorPlanImportScope) || "general_reference",
  );
  const [spaceId, setSpaceId] = React.useState<string>(String(p.spaceId ?? "") || "");
  const [eventId, setEventId] = React.useState<string>(String(p.eventId ?? "") || "");
  const [saving, setSaving] = React.useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      const space = spaces.find((s) => s.id === spaceId);
      const event = events.find((e) => e.id === eventId);
      const result = await resolveFloorPlanImportRecordAction(sessionId, record.id, {
        scope,
        spaceId: scope === "space_master" ? (spaceId || null) : null,
        spaceName: space?.name ?? (p.spaceName as string | null) ?? null,
        eventId: scope === "event_specific" ? (eventId || null) : null,
        eventName: event?.name ?? (p.eventName as string | null) ?? null,
        eventDate: event?.eventDate ?? (p.eventDate as string | null) ?? null,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Floor plan match updated.");
      onResolved();
    } finally {
      setSaving(false);
    }
  }

  async function handleExclude() {
    setSaving(true);
    try {
      const result = await reviewMigrationRecordAction(sessionId, record.id, "reject");
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Floor plan left out of this import.");
      onResolved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border px-3 py-2">
      <p className="truncate text-sm font-medium text-heading">{String(p.name ?? p.fileName ?? "Floor plan")}</p>
      {record.validationErrors?.[0] && (
        <p className="text-[11px] text-muted-foreground">{record.validationErrors[0]}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[11px]">Type</Label>
          <Select
            value={scope}
            onValueChange={(v) => setScope(v as FloorPlanImportScope)}
            items={(Object.keys(SCOPE_LABEL) as FloorPlanImportScope[]).map((k) => ({ value: k, label: SCOPE_LABEL[k] }))}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(SCOPE_LABEL) as FloorPlanImportScope[]).map((k) => (
                <SelectItem key={k} value={k}>{SCOPE_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {scope === "space_master" && (
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-[11px]">Space</Label>
            <Select
              value={spaceId || "__none"}
              onValueChange={(v) => setSpaceId(v === "__none" ? "" : v)}
              items={[{ value: "__none", label: "Choose a Space" }, ...spaces.map((s) => ({ value: s.id, label: s.name }))]}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose a Space" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Choose a Space</SelectItem>
                {spaces.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {scope === "event_specific" && (
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-[11px]">Event</Label>
            <Select
              value={eventId || "__none"}
              onValueChange={(v) => setEventId(v === "__none" ? "" : v)}
              items={[
                { value: "__none", label: "Choose an Event" },
                ...events.map((ev) => ({
                  value: ev.id,
                  label: `${ev.name}${ev.eventDate ? ` · ${ev.eventDate}` : ""}`,
                })),
              ]}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose an Event" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Choose an Event</SelectItem>
                {events.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {ev.name}{ev.eventDate ? ` · ${ev.eventDate}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleConfirm} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Confirm match
        </Button>
        <Button size="sm" variant="outline" onClick={handleExclude} disabled={saving}>
          Don&apos;t import
        </Button>
      </div>
    </div>
  );
}
