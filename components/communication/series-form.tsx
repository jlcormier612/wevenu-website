"use client";

import * as React from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Mail, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createSeriesAction, updateSeriesAction } from "@/app/(app)/communication/series/actions";
import { LibrarySaveStatus } from "@/components/library/library-save-status";
import { LIBRARY_LABELS, useLibraryUnsavedGuard } from "@/components/library/use-library-unsaved-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildAutomationBehaviorSummary } from "@/lib/message-sequences/behavior-summary";
import { SEQUENCE_TRIGGER_STAGES, SEQUENCE_TRIGGER_TYPES } from "@/lib/message-sequences/constants";
import { automationStepTimingLabel } from "@/lib/message-sequences/timing-labels";
import { salesStageLabel } from "@/lib/leads/constants";
import { substituteSampleMergeFields } from "@/lib/message-templates/preview";
import type {
  CreateSequenceResult, MessageSequenceInput, MessageSequenceWithSteps, SequenceErrors, SequenceStepInput,
} from "@/lib/message-sequences/types";
import type { MessageTemplate } from "@/lib/message-templates/types";

const NO_TRIGGER = "__manual__";

function buildInitial(series?: MessageSequenceWithSteps | null): MessageSequenceInput {
  return {
    name: series?.name ?? "",
    triggerType: series?.triggerType ?? null,
    triggerStage: series?.triggerStage ?? null,
    updatePipelineOnEnroll: series?.updatePipelineOnEnroll ?? false,
    steps: series?.steps.map((s) => ({ templateId: s.templateId, channel: s.channel, offsetDays: s.offsetDays })) ?? [],
  };
}

function emptyStep(): SequenceStepInput {
  return { templateId: "", channel: "email", offsetDays: 1 };
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-semibold text-heading">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AutomationStepTemplatePreview({
  template,
  channel,
  editHref,
}: {
  template: MessageTemplate;
  channel: SequenceStepInput["channel"];
  editHref: string;
}) {
  const isEmail = channel === "email";
  const subject = template.emailSubject ?? "";
  const body = isEmail ? (template.emailBody ?? "") : (template.smsBody ?? "");

  return (
    <div className="min-w-0 space-y-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {isEmail ? <Mail className="h-3.5 w-3.5" aria-hidden /> : <MessageSquare className="h-3.5 w-3.5" aria-hidden />}
        <span>{isEmail ? "Email" : "SMS"}</span>
        <span className="normal-case tracking-normal text-muted-foreground/80">· from “{template.name}”</span>
      </div>
      {isEmail && subject.trim() && (
        <p className="min-w-0 break-words text-sm font-semibold text-heading">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Subject</span>
          {substituteSampleMergeFields(subject)}
        </p>
      )}
      <div className="min-w-0 space-y-1">
        {isEmail && (
          <p className="text-xs font-medium text-muted-foreground">Message body</p>
        )}
        {!isEmail && (
          <p className="text-xs font-medium text-muted-foreground">Message</p>
        )}
        <p className="min-w-0 whitespace-pre-wrap break-words text-sm text-foreground">
          {body.trim() ? substituteSampleMergeFields(body) : (
            <span className="text-muted-foreground">This template has no {isEmail ? "email" : "SMS"} content.</span>
          )}
        </p>
      </div>
      <div>
        <Link
          href={editHref}
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Edit message
        </Link>
      </div>
    </div>
  );
}

export function SeriesForm({
  series,
  templates,
}: {
  series?: MessageSequenceWithSteps | null;
  templates: MessageTemplate[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isEdit = !!series;
  const [baseline] = React.useState(() => JSON.stringify(buildInitial(series)));
  const [input, setInput] = React.useState<MessageSequenceInput>(() => buildInitial(series));
  const [errors, setErrors] = React.useState<SequenceErrors>({});
  const [pending, startTransition] = React.useTransition();
  const dirty = JSON.stringify(input) !== baseline;
  const { confirmLeave } = useLibraryUnsavedGuard(dirty);
  const preview = buildAutomationBehaviorSummary(input);
  const returnTo = encodeURIComponent(pathname || "/communication/series");

  const stageItems = SEQUENCE_TRIGGER_STAGES.map((s) => ({
    value: s.value,
    label: salesStageLabel(s.value),
  }));

  const set = <K extends keyof MessageSequenceInput>(key: K, v: MessageSequenceInput[K]) => {
    setInput((p) => ({ ...p, [key]: v }));
    setErrors((p) => { const n = { ...p }; delete n[key as string]; return n; });
  };

  function updateStep(index: number, patch: Partial<SequenceStepInput>) {
    setInput((p) => ({ ...p, steps: p.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
    setErrors((p) => { const n = { ...p }; delete n.steps; return n; });
  }

  function addStep() {
    setInput((p) => ({ ...p, steps: [...p.steps, emptyStep()] }));
  }

  function removeStep(index: number) {
    setInput((p) => ({ ...p, steps: p.steps.filter((_, i) => i !== index) }));
  }

  function moveStep(index: number, dir: -1 | 1) {
    setInput((p) => {
      const target = index + dir;
      if (target < 0 || target >= p.steps.length) return p;
      const steps = [...p.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...p, steps };
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = isEdit
        ? await updateSeriesAction(series!.id, input)
        : await createSeriesAction(input);
      if (result.ok) {
        toast.success(isEdit ? "Automation updated." : "Automation created.");
        router.push("/communication/series");
        return;
      }
      const errs = "errors" in result ? (result as Extract<CreateSequenceResult, { ok: false }>).errors : undefined;
      if (errs) setErrors(errs);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-8">
      {isEdit && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Saving changes applies to people who enter this automation after you save. People already in this automation keep the steps they started with.
        </p>
      )}

      <section className="space-y-3">
        <SectionHeading title="Name" hint="Something you’ll recognize on the Automations list." />
        <div className="max-w-lg space-y-1.5">
          <Label htmlFor="sn">Automation name *</Label>
          <Input id="sn" value={input.name} onChange={(e) => set("name", e.target.value)}
            placeholder="New Inquiry Follow-Up" aria-invalid={errors.name ? true : undefined} />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Who it starts for"
          hint="Choose when someone should begin receiving these messages."
        />
        <div className="max-w-lg space-y-1.5">
          <Label htmlFor="strig">Starts when…</Label>
          <Select
            value={input.triggerType ?? NO_TRIGGER}
            onValueChange={(v) => {
              const next = v === NO_TRIGGER ? null : (v as MessageSequenceInput["triggerType"]);
              set("triggerType", next);
              if (v !== "lead_stage_changed") set("triggerStage", null);
              if (next && !["lead_created", "lead_stage_changed", "tour_completed"].includes(next)) {
                set("updatePipelineOnEnroll", false);
              }
            }}
            items={[
              { value: NO_TRIGGER, label: "Manual only — I'll add people myself" },
              ...SEQUENCE_TRIGGER_TYPES.map((t) => ({ value: t.value, label: t.label })),
            ]}
          >
            <SelectTrigger id="strig" className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TRIGGER}>Manual only — I&apos;ll add people myself</SelectItem>
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sales</p>
              {SEQUENCE_TRIGGER_TYPES.filter((t) => t.audience === "sales").map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Client</p>
              {SEQUENCE_TRIGGER_TYPES.filter((t) => t.audience === "client").map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {input.triggerType && (
            <p className="text-xs text-muted-foreground">
              {SEQUENCE_TRIGGER_TYPES.find((t) => t.value === input.triggerType)?.description}
            </p>
          )}
        </div>

        {input.triggerType === "lead_stage_changed" && (
          <div className="max-w-md space-y-1.5">
            <Label htmlFor="sstage">Which stage?</Label>
            <Select value={input.triggerStage ?? ""} onValueChange={(v) => set("triggerStage", v)} items={stageItems}>
              <SelectTrigger id="sstage" className="h-9 text-sm" aria-invalid={errors.triggerStage ? true : undefined}>
                <SelectValue placeholder="Choose a stage" />
              </SelectTrigger>
              <SelectContent>
                {stageItems.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.triggerStage && <p className="text-xs text-destructive">{errors.triggerStage}</p>}
          </div>
        )}

        {(!input.triggerType || ["lead_created", "lead_stage_changed", "tour_completed"].includes(input.triggerType)) && (
        <label className="flex max-w-xl cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card/40 px-3 py-2.5">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={input.updatePipelineOnEnroll === true}
            onChange={(e) => set("updatePipelineOnEnroll", e.target.checked)}
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium text-heading">
              Also move their sales stage forward when they enter this automation
            </span>
            <span className="block text-xs text-muted-foreground">
              Off by default. When on, an open lead advances one stage on your active Pipeline when they enter this automation. Never moves Booked or Lost, and never moves someone backward.
            </span>
          </span>
        </label>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeading
            title="What happens"
            hint="Messages send in the order you set them. A message set to 0 days sends immediately. Messages scheduled for a later day go out at 10:00 AM in your venue’s local time."
          />
          <Button type="button" size="sm" variant="outline" onClick={addStep} className="shrink-0 self-start">
            + Add message
          </Button>
        </div>
        {errors.steps && <p className="text-xs text-destructive">{errors.steps}</p>}

        {input.steps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No messages yet. Add one to say what gets sent.
          </p>
        ) : (
          <div className="space-y-3">
            {input.steps.map((step, i) => {
              const eligible = templates.filter((t) => (step.channel === "email" ? !!t.emailBody : !!t.smsBody));
              const selected = templates.find((t) => t.id === step.templateId) ?? null;
              const isFirst = i === 0;
              return (
                <div key={i} className="min-w-0 space-y-3 rounded-lg border border-border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex shrink-0 items-center gap-1 self-start">
                      <Button type="button" size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => moveStep(i, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" disabled={i === input.steps.length - 1} onClick={() => moveStep(i, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <span className="ml-1 text-xs font-medium text-muted-foreground">Message {i + 1}</span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-[11rem]">
                      <Label className="text-xs">When</Label>
                      <Input
                        type="number"
                        min={0}
                        value={step.offsetDays}
                        onChange={(e) => updateStep(i, { offsetDays: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        className="h-9 text-sm"
                        aria-label={automationStepTimingLabel(step.offsetDays, isFirst)}
                      />
                      <p className="text-xs font-medium text-heading">
                        {automationStepTimingLabel(step.offsetDays, isFirst)}
                      </p>
                    </div>

                    <div className="space-y-1.5 sm:w-28">
                      <Label className="text-xs">Send as</Label>
                      <Select value={step.channel} onValueChange={(v) => updateStep(i, { channel: v as SequenceStepInput["channel"], templateId: "" })}
                        items={[{ value: "email", label: "Email" }, { value: "sms", label: "Text" }]}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">Text</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label className="text-xs">Message Template</Label>
                      <Select value={step.templateId} onValueChange={(v) => updateStep(i, { templateId: v })}
                        items={eligible.map((t) => ({ value: t.id, label: t.name }))}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose a template" /></SelectTrigger>
                        <SelectContent>
                          {eligible.length === 0 && (
                            <p className="px-2 py-1.5 text-xs text-muted-foreground">No {step.channel === "email" ? "email" : "text"} templates yet</p>
                          )}
                          {eligible.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeStep(i)}
                      className="self-start text-muted-foreground hover:text-destructive sm:self-end">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {selected && (
                    <AutomationStepTemplatePreview
                      template={selected}
                      channel={step.channel}
                      editHref={`/communication/templates/${selected.id}/edit?returnTo=${returnTo}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <SectionHeading title="When it stops" />
        <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
          {preview.lines.stops} Pausing the whole automation pauses scheduled messages for everyone in it until you resume.
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold text-heading">What will happen?</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{preview.paragraph}</p>
        {preview.lines.steps.length > 0 && (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {preview.lines.steps.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex items-center justify-end gap-3">
        <LibrarySaveStatus status={pending ? "saving" : dirty ? "dirty" : "idle"} model="explicit" className="mr-auto" />
        <Button type="button" variant="outline" onClick={() => { if (confirmLeave()) router.back(); }} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={handleSubmit} disabled={pending || (isEdit && !dirty)}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />{LIBRARY_LABELS.saving}</> : isEdit ? LIBRARY_LABELS.saveChanges : "Create automation"}
        </Button>
      </div>
    </div>
  );
}
