"use client";

/**
 * Full-page Library editor for Questionnaire & Feedback templates.
 * Customer-facing language only — no engineering jargon.
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown, ArrowUp, Eye, Loader2, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { saveQuestionnaireAuthoringAction } from "@/app/(app)/events/[id]/questionnaire-actions";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { LibrarySaveStatus } from "@/components/library/library-save-status";
import { librarySavedToastMessage, useLibraryUnsavedGuard } from "@/components/library/use-library-unsaved-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getQuestionnaireMasterByKind,
} from "@/lib/questionnaire-family/definitions";
import {
  isSystemConnectedField,
  newCustomFieldId,
  type CustomQuestionnaireField,
  type CustomQuestionnaireFieldType,
  type MasterOverrides,
} from "@/lib/questionnaire-family/resolve";
import type { QuestionnaireTemplate } from "@/lib/questionnaire-templates/service";

const CUSTOM_TYPE_OPTIONS: { value: CustomQuestionnaireFieldType; label: string }[] = [
  { value: "short_text", label: "Short answer" },
  { value: "long_text", label: "Long answer" },
  { value: "yes_no", label: "Yes / No" },
  { value: "single_choice", label: "Single choice" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "date", label: "Date" },
];

type EditorState = {
  name: string;
  description: string;
  included: string[];
  required: string[];
  customs: CustomQuestionnaireField[];
  overrides: MasterOverrides;
  order: string[];
};

function buildInitial(template: QuestionnaireTemplate): EditorState {
  const master = getQuestionnaireMasterByKind(template.kind);
  const masterIds = master.fields.map((f) => f.id);
  const customs = template.customFields ?? [];
  const included = template.includedFields?.length
    ? [...template.includedFields]
    : [...masterIds, ...customs.map((c) => c.id)];
  const required = template.requiredFields?.length
    ? [...template.requiredFields]
    : master.fields.filter((f) => f.required).map((f) => f.id);
  const order = template.fieldOrder?.length
    ? [...template.fieldOrder]
    : [...masterIds, ...customs.map((c) => c.id)];
  return {
    name: template.name,
    description: template.description ?? "",
    included,
    required,
    customs: customs.map((c) => ({ ...c, options: c.options ? [...c.options] : undefined })),
    overrides: { ...(template.masterOverrides ?? {}) },
    order,
  };
}

function friendlyConnectedHint(fieldId: string, type: string): string | null {
  if (type === "guest_count_confirm") return "Connected to your guest count";
  if (type === "vendor_review") return "Connected to vendors on this event";
  if (type === "known_timing_confirm" || type === "known_ceremony_confirm") {
    return "Uses timing details already on the event";
  }
  if (fieldId === "emergency_contact_name" || fieldId === "emergency_contact_phone") {
    return "Saved to the event record";
  }
  if ([
    "meal_notes", "processional_song", "recessional_song", "first_dance_song",
    "parent_dances", "special_requests", "vendor_notes",
    "ceremony_start_time", "reception_start_time", "ceremony_location", "reception_location",
  ].includes(fieldId)) {
    return "Saved to the event record";
  }
  return null;
}

export function QuestionnaireAuthoringWorkspace({
  template,
}: {
  template: QuestionnaireTemplate;
}) {
  const router = useRouter();
  const master = getQuestionnaireMasterByKind(template.kind);
  const [baseline, setBaseline] = React.useState(() => JSON.stringify(buildInitial(template)));
  const [state, setState] = React.useState<EditorState>(() => buildInitial(template));
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [savedFlash, setSavedFlash] = React.useState(false);
  const dirty = JSON.stringify(state) !== baseline;
  const { confirmLeave } = useLibraryUnsavedGuard(dirty && !pending);

  const masterById = React.useMemo(
    () => new Map(master.fields.map((f) => [f.id, f])),
    [master.fields],
  );
  const customById = React.useMemo(
    () => new Map(state.customs.map((c) => [c.id, c])),
    [state.customs],
  );

  const orderedIds = React.useMemo(() => {
    const all = new Set([
      ...master.fields.map((f) => f.id),
      ...state.customs.map((c) => c.id),
    ]);
    const out: string[] = [];
    const seen = new Set<string>();
    for (const id of state.order) {
      if (!all.has(id) || seen.has(id)) continue;
      out.push(id);
      seen.add(id);
    }
    for (const id of all) {
      if (!seen.has(id)) out.push(id);
    }
    return out;
  }, [master.fields, state.customs, state.order]);

  function patch(partial: Partial<EditorState>) {
    setSavedFlash(false);
    setState((prev) => ({ ...prev, ...partial }));
  }

  function move(id: string, dir: -1 | 1) {
    const idx = orderedIds.indexOf(id);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= orderedIds.length) return;
    const next = [...orderedIds];
    const [item] = next.splice(idx, 1);
    next.splice(nextIdx, 0, item);
    patch({ order: next });
  }

  function setIncluded(id: string, on: boolean) {
    const included = on
      ? [...new Set([...state.included, id])]
      : state.included.filter((x) => x !== id);
    const required = on ? state.required : state.required.filter((x) => x !== id);
    patch({ included, required });
  }

  function setRequired(id: string, on: boolean) {
    if (!state.included.includes(id)) return;
    patch({
      required: on
        ? [...new Set([...state.required, id])]
        : state.required.filter((x) => x !== id),
    });
  }

  function updateMasterWording(id: string, label: string, helper: string) {
    const base = masterById.get(id);
    if (!base) return;
    const next = { ...state.overrides };
    const entry: { label?: string; helper?: string | null } = {};
    if (label.trim() && label.trim() !== base.label) entry.label = label.trim();
    const baseHelper = base.helper ?? "";
    if (helper.trim() !== baseHelper) {
      entry.helper = helper.trim() ? helper : null;
    }
    if (entry.label !== undefined || entry.helper !== undefined) next[id] = entry;
    else delete next[id];
    patch({ overrides: next });
  }

  function updateCustom(id: string, next: Partial<CustomQuestionnaireField>) {
    patch({
      customs: state.customs.map((c) => (c.id === id ? { ...c, ...next } : c)),
    });
  }

  function addCustomQuestion() {
    const id = newCustomFieldId();
    const field: CustomQuestionnaireField = {
      id,
      section: "Your Questions",
      label: "New question",
      required: false,
      type: "long_text",
      destination: "family",
    };
    patch({
      customs: [...state.customs, field],
      included: [...state.included, id],
      order: [...orderedIds, id],
    });
  }

  function removeCustom(id: string) {
    patch({
      customs: state.customs.filter((c) => c.id !== id),
      included: state.included.filter((x) => x !== id),
      required: state.required.filter((x) => x !== id),
      order: state.order.filter((x) => x !== id),
    });
  }

  function handleSave() {
    const snapshot: EditorState = { ...state, order: orderedIds };
    startTransition(async () => {
      const result = await saveQuestionnaireAuthoringAction(template.id, {
        name: snapshot.name,
        description: snapshot.description,
        includedFields: snapshot.included,
        requiredFields: snapshot.required,
        customFields: snapshot.customs,
        masterOverrides: snapshot.overrides,
        fieldOrder: snapshot.order,
      });
      if (result.ok) {
        setError("");
        setState(snapshot);
        setBaseline(JSON.stringify(snapshot));
        setSavedFlash(true);
        toast.success(librarySavedToastMessage());
        router.refresh();
      } else {
        setError(result.message ?? "Could not save.");
      }
    });
  }

  const sections = React.useMemo(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const id of orderedIds) {
      const masterField = masterById.get(id);
      const custom = customById.get(id);
      const section = custom?.section || masterField?.section || "Your Questions";
      if (!seen.has(section)) {
        seen.add(section);
        order.push(section);
      }
    }
    return order;
  }, [orderedIds, masterById, customById]);

  const saveStatus = pending ? "saving" : dirty ? "dirty" : savedFlash ? "saved" : "idle";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-medium tracking-tight text-heading">Edit questionnaire</h1>
            {template.sourceMasterKey && (
              <Badge variant="muted" className="text-[10px]">{LIBRARY_LABELS.starter}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{state.name || template.name}</p>
          <LibrarySaveStatus status={saveStatus} model="explicit" />
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            render={<Link href={`/library/questionnaire-templates/${template.id}/preview`} />}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            {LIBRARY_LABELS.preview}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirmLeave()) router.push("/library/questionnaire-templates");
            }}
            disabled={pending}
          >
            {LIBRARY_LABELS.cancel}
          </Button>
          <Button type="button" size="sm" disabled={!state.name.trim() || pending || !dirty} onClick={handleSave}>
            {pending ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{LIBRARY_LABELS.saving}</>
            ) : LIBRARY_LABELS.saveChanges}
          </Button>
        </div>
      </header>

      <p className="text-sm text-muted-foreground">
        Changes here update this reusable questionnaire. Working forms already sent to couples are not changed.
      </p>

      <div className="space-y-4 rounded-sm border border-border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="q-name">Name</Label>
          <Input
            id="q-name"
            value={state.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-purpose">Purpose</Label>
          <Textarea
            id="q-purpose"
            rows={2}
            value={state.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section}</h2>
            <div className="space-y-3">
              {orderedIds
                .filter((id) => {
                  const m = masterById.get(id);
                  const c = customById.get(id);
                  return (c?.section || m?.section || "Your Questions") === section;
                })
                .map((id) => {
                  const masterField = masterById.get(id);
                  const custom = customById.get(id);
                  const isCustom = Boolean(custom);
                  const included = state.included.includes(id);
                  const req = state.required.includes(id);
                  const idx = orderedIds.indexOf(id);
                  const connected = masterField
                    ? isSystemConnectedField(masterField)
                    : false;
                  const label = isCustom
                    ? custom!.label
                    : (state.overrides[id]?.label ?? masterField?.label ?? id);
                  const helper = isCustom
                    ? (custom!.helper ?? "")
                    : (state.overrides[id]?.helper === null
                      ? ""
                      : (state.overrides[id]?.helper ?? masterField?.helper ?? ""));
                  const connectedHint = masterField
                    ? friendlyConnectedHint(masterField.id, masterField.type)
                    : null;

                  return (
                    <div
                      key={id}
                      className={`rounded-sm border border-border p-3 space-y-3 ${!included ? "opacity-60" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-medium text-heading truncate">{label || "Untitled question"}</p>
                          {connectedHint && (
                            <p className="text-[11px] text-muted-foreground">{connectedHint}</p>
                          )}
                          {isCustom && (
                            <p className="text-[11px] text-muted-foreground">Your question</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <Button type="button" size="sm" variant="ghost" disabled={idx <= 0} onClick={() => move(id, -1)} aria-label="Move up">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" size="sm" variant="ghost" disabled={idx >= orderedIds.length - 1} onClick={() => move(id, 1)} aria-label="Move down">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          {isCustom && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => removeCustom(id)} aria-label="Remove question">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Question wording</Label>
                        <Textarea
                          rows={2}
                          value={label}
                          onChange={(e) => {
                            if (isCustom) updateCustom(id, { label: e.target.value });
                            else updateMasterWording(id, e.target.value, helper);
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Helper text</Label>
                        <Textarea
                          rows={2}
                          value={helper}
                          onChange={(e) => {
                            if (isCustom) updateCustom(id, { helper: e.target.value || undefined });
                            else updateMasterWording(id, label, e.target.value);
                          }}
                        />
                      </div>

                      {isCustom && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Answer type</Label>
                            <select
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                              value={custom!.type}
                              onChange={(e) => {
                                const type = e.target.value as CustomQuestionnaireFieldType;
                                const needsOptions = type === "single_choice" || type === "multiple_choice";
                                updateCustom(id, {
                                  type,
                                  options: needsOptions
                                    ? (custom!.options?.length
                                      ? custom!.options
                                      : [
                                        { value: "option_1", label: "Option 1" },
                                        { value: "option_2", label: "Option 2" },
                                      ])
                                    : undefined,
                                });
                              }}
                            >
                              {CUSTOM_TYPE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Section</Label>
                            <Input
                              value={custom!.section}
                              onChange={(e) => updateCustom(id, { section: e.target.value || "Your Questions" })}
                            />
                          </div>
                        </div>
                      )}

                      {isCustom && (custom!.type === "single_choice" || custom!.type === "multiple_choice") && (
                        <div className="space-y-2">
                          <Label className="text-xs">Choices</Label>
                          {(custom!.options ?? []).map((opt, i) => (
                            <div key={`${id}-opt-${i}`} className="flex gap-2">
                              <Input
                                value={opt.label}
                                onChange={(e) => {
                                  const options = [...(custom!.options ?? [])];
                                  const labelText = e.target.value;
                                  const value = labelText.trim().toLowerCase().replace(/\s+/g, "_") || `option_${i + 1}`;
                                  options[i] = { value, label: labelText };
                                  updateCustom(id, { options });
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={(custom!.options?.length ?? 0) <= 1}
                                onClick={() => {
                                  const options = (custom!.options ?? []).filter((_, j) => j !== i);
                                  updateCustom(id, { options });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const n = (custom!.options?.length ?? 0) + 1;
                              updateCustom(id, {
                                options: [...(custom!.options ?? []), { value: `option_${n}`, label: `Option ${n}` }],
                              });
                            }}
                          >
                            Add choice
                          </Button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <label className="inline-flex items-center gap-2">
                          <Checkbox
                            checked={included}
                            onCheckedChange={(v) => setIncluded(id, v === true)}
                          />
                          <span>Ask this question</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <Checkbox
                            checked={req}
                            disabled={!included}
                            onCheckedChange={(v) => setRequired(id, v === true)}
                          />
                          <span>Required</span>
                        </label>
                        {!included && !isCustom && (
                          <span className="text-xs text-muted-foreground">Don&apos;t ask — question stays available to restore</span>
                        )}
                        {connected && (
                          <span className="text-xs text-muted-foreground">Answer type is fixed</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={addCustomQuestion}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add question
        </Button>
        <Button type="button" disabled={!state.name.trim() || pending || !dirty} onClick={handleSave}>
          {pending ? (
            <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{LIBRARY_LABELS.saving}</>
          ) : LIBRARY_LABELS.saveChanges}
        </Button>
        <LibrarySaveStatus status={saveStatus} model="explicit" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
