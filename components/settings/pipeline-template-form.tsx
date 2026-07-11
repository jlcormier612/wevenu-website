"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { GripVertical, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createPipelineTemplateAction, updatePipelineTemplateAction } from "@/app/(app)/library/pipeline-templates/actions";
import { Button } from "@/components/ui/button";
import { ColorPickerTrigger } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CANONICAL_STAGES, DEFAULT_STAGE_COLOR } from "@/lib/pipeline-templates/constants";
import type {
  PipelineTemplateErrors, PipelineTemplateInput, PipelineTemplateWithStages, PipelineStageInput,
} from "@/lib/pipeline-templates/types";

function buildInitial(template?: PipelineTemplateWithStages | null): PipelineTemplateInput {
  return {
    name: template?.name ?? "",
    description: template?.description ?? "",
    isActive: template?.isActive ?? true,
    stages: template?.stages.map((s) => ({
      name: s.name, color: s.color, canonicalStage: s.canonicalStage,
      probability: s.probability != null ? String(s.probability) : "",
    })) ?? [],
  };
}

function emptyStage(): PipelineStageInput {
  return { name: "", color: DEFAULT_STAGE_COLOR, canonicalStage: "inquiry", probability: "" };
}

export function PipelineTemplateForm({ template }: { template?: PipelineTemplateWithStages | null }) {
  const router = useRouter();
  const isEdit = !!template;
  const [input, setInput] = React.useState<PipelineTemplateInput>(() => buildInitial(template));
  const [errors, setErrors] = React.useState<PipelineTemplateErrors>({});
  const [pending, startTransition] = React.useTransition();
  const dragIndex = React.useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  const set = <K extends keyof PipelineTemplateInput>(key: K, v: PipelineTemplateInput[K]) => {
    setInput((p) => ({ ...p, [key]: v }));
    setErrors((p) => { const n = { ...p }; delete n[key as string]; return n; });
  };

  function updateStage(index: number, patch: Partial<PipelineStageInput>) {
    setInput((p) => ({ ...p, stages: p.stages.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
    setErrors((p) => { const n = { ...p }; delete n.stages; return n; });
  }

  function addStage() {
    setInput((p) => ({ ...p, stages: [...p.stages, emptyStage()] }));
  }

  function removeStage(index: number) {
    setInput((p) => ({ ...p, stages: p.stages.filter((_, i) => i !== index) }));
  }

  // ── Native HTML5 drag-and-drop reorder — no external library, same
  // primitives already used for file drop zones elsewhere in this codebase,
  // just applied to reordering an array instead of accepting a file. ──
  function handleDragStart(index: number) {
    dragIndex.current = index;
  }
  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }
  function handleDrop(index: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setDragOverIndex(null);
    if (from === null || from === index) return;
    setInput((p) => {
      const stages = [...p.stages];
      const [moved] = stages.splice(from, 1);
      stages.splice(index, 0, moved);
      return { ...p, stages };
    });
  }
  function handleDragEnd() {
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = isEdit
        ? await updatePipelineTemplateAction(template!.id, input)
        : await createPipelineTemplateAction(input);
      if (result.ok) {
        toast.success(isEdit ? "Pipeline template updated." : "Pipeline template created.");
        router.push("/library/pipeline-templates");
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ptn">Pipeline name *</Label>
          <Input id="ptn" value={input.name} onChange={(e) => set("name", e.target.value)}
            placeholder="Standard Wedding Pipeline" aria-invalid={errors.name ? true : undefined} />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="flex items-end gap-2 pb-1.5">
          <Switch checked={input.isActive} onCheckedChange={(v) => set("isActive", v)} />
          <Label className="text-sm text-foreground">Active</Label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ptd">Description</Label>
        <Textarea id="ptd" value={input.description} onChange={(e) => set("description", e.target.value)}
          rows={2} placeholder="What kind of bookings is this pipeline for?" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-heading">Stages</p>
          <Button type="button" size="sm" variant="outline" onClick={addStage}>+ Add Stage</Button>
        </div>
        {errors.stages && <p className="text-xs text-destructive">{errors.stages}</p>}

        {input.stages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No stages yet. Add one to build this pipeline.
          </p>
        ) : (
          <div className="space-y-2">
            {input.stages.map((stage, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-end ${dragOverIndex === i ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="flex shrink-0 cursor-grab items-center gap-1.5 self-start pt-2 text-muted-foreground sm:pt-0 sm:self-center" aria-label="Drag to reorder">
                  <GripVertical className="h-4 w-4" />
                  <span className="text-xs font-medium">{i + 1}</span>
                </div>

                <div className="space-y-1.5 sm:w-40">
                  <Label className="text-xs">Stage name</Label>
                  <Input value={stage.name} onChange={(e) => updateStage(i, { name: e.target.value })}
                    placeholder="Tour Scheduled" className="h-9 text-sm" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Color</Label>
                  <ColorPickerTrigger value={stage.color} onChange={(hex) => updateStage(i, { color: hex })} />
                </div>

                <div className="flex-1 space-y-1.5 sm:min-w-40">
                  <Label className="text-xs">Canonical stage</Label>
                  <Select value={stage.canonicalStage} onValueChange={(v) => updateStage(i, { canonicalStage: v as PipelineStageInput["canonicalStage"] })}
                    items={CANONICAL_STAGES}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CANONICAL_STAGES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:w-28">
                  <Label className="text-xs">Probability %</Label>
                  <Input type="number" min={0} max={100} value={stage.probability}
                    onChange={(e) => updateStage(i, { probability: e.target.value })}
                    placeholder="Optional" className="h-9 text-sm" />
                </div>

                <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeStage(i)}
                  className="self-start text-muted-foreground hover:text-destructive sm:self-end">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : isEdit ? "Save changes" : "Create pipeline template"}
        </Button>
      </div>
    </div>
  );
}
