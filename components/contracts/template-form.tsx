"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { createTemplateAction, updateTemplateAction } from "@/app/(app)/contracts/actions";
import { LibrarySaveStatus } from "@/components/library/library-save-status";
import { librarySavedToastMessage, useLibraryUnsavedGuard } from "@/components/library/use-library-unsaved-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_TEMPLATE_DESCRIPTION, DEFAULT_TEMPLATE_NAME, MERGE_FIELDS } from "@/lib/contracts/constants";
import type { ContractErrors, ContractTemplate, TemplateInput } from "@/lib/contracts/types";

function buildInitial(template?: ContractTemplate | null): TemplateInput {
  return {
    name: template?.name ?? "",
    description: template?.description ?? "",
    content: template?.content ?? "",
    isDefault: template?.isDefault ?? false,
  };
}

export function TemplateForm({ template }: { template?: ContractTemplate | null }) {
  const router = useRouter();
  // template is truthy even on the New Template page (it's seeded with starter
  // content/isDefault so the form has something to show) — only a real,
  // persisted template has an id, so that's the actual edit-vs-create signal.
  const isEdit = !!template?.id;
  const [baseline] = React.useState(() => JSON.stringify(buildInitial(template)));
  const [input, setInput] = React.useState<TemplateInput>(() => buildInitial(template));
  const [errors, setErrors] = React.useState<ContractErrors>({});
  const [pending, startTransition] = React.useTransition();
  const dirty = JSON.stringify(input) !== baseline;
  const { confirmLeave } = useLibraryUnsavedGuard(dirty);

  const [importOpen, setImportOpen] = React.useState(false);
  const [importText, setImportText] = React.useState("");
  const [importFileName, setImportFileName] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof TemplateInput>(key: K, v: TemplateInput[K]) => {
    setInput((p) => ({ ...p, [key]: v }));
    setErrors((p) => { const n = { ...p }; delete n[key as string]; return n; });
  };

  async function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt")) {
      toast.error("This file type isn't supported yet — try a .txt file, or paste the text instead.");
      return;
    }
    setImportFileName(file.name);
    setImportText(await file.text());
  }

  // Deterministic, no AI involved — a contract's own wording is the source
  // of truth, this is transcription into the field, not structuring
  // (template-import review, 2026-07-22: "contracts will need to be copy
  // and pastable at a minimum from outside documents"). Also clears the
  // starter boilerplate name/description this form seeds new templates
  // with, but only if they're still untouched — never clobbers a name the
  // venue already typed.
  function handleUseImportText() {
    if (!importText.trim()) return;
    setInput((p) => ({
      ...p,
      content: importText,
      name: p.name.trim() === DEFAULT_TEMPLATE_NAME ? "" : p.name,
      description: p.description.trim() === DEFAULT_TEMPLATE_DESCRIPTION ? "" : p.description,
    }));
    setErrors((p) => { const n = { ...p }; delete n.content; return n; });
    setImportOpen(false);
    setImportText("");
    setImportFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success("Pasted in — review it below before saving.");
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = isEdit
        ? await updateTemplateAction(template!.id, input)
        : await createTemplateAction(input);
      if (result.ok) {
        toast.success(isEdit ? librarySavedToastMessage() : "Template created.");
        router.push("/contracts/templates");
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        This is your <span className="font-medium text-heading">template</span>
        {isEdit ? " — edits here do not change agreements already created for clients." : "."}
        {" "}Your agreement should use language approved for your venue. Hello to Cheers provides this template as a starting structure and does not provide legal advice.
      </div>

      {!isEdit && (
        <div className="rounded-lg border border-dashed border-border p-4">
          {!importOpen ? (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Sparkles className="h-4 w-4" />
              Paste or upload an existing contract instead
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-heading">Bring your existing contract</p>
                <button type="button" onClick={() => setImportOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your own wording is the source of truth — this copies it in exactly as written. Nothing is saved until you click Create.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Upload a file <span className="font-normal text-muted-foreground">(optional — .txt)</span></Label>
                <input
                  ref={fileInputRef}
                  type="file" accept=".txt,text/plain"
                  onChange={handleImportFileChange}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                />
                {importFileName && <p className="text-xs text-muted-foreground">Loaded {importFileName}</p>}
              </div>
              <Textarea
                value={importText} onChange={(e) => setImportText(e.target.value)}
                placeholder="Or paste your existing contract text here…"
                className="min-h-32 text-sm"
              />
              <div className="flex items-center justify-end">
                <Button type="button" size="sm" onClick={handleUseImportText} disabled={!importText.trim()}>
                  Use this text
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tn">Template name *</Label>
          <Input id="tn" value={input.name} onChange={(e) => set("name", e.target.value)}
            placeholder="Wedding Venue Agreement" aria-invalid={errors.name ? true : undefined} />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="td">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="td" value={input.description} onChange={(e) => set("description", e.target.value)}
            placeholder="Brief description of this template" />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <Switch id="tdef" checked={input.isDefault} onCheckedChange={(c) => set("isDefault", c)} />
          <Label htmlFor="tdef" className="cursor-pointer">
            Set as default template
            <span className="block text-xs font-normal text-muted-foreground mt-0.5">
              Pre-selected when creating a new contract.
            </span>
          </Label>
        </div>
      </div>

      {/* Split editor */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="tc">Contract content *</Label>
          <Textarea id="tc" value={input.content} onChange={(e) => set("content", e.target.value)}
            rows={24} className="font-mono text-sm" aria-invalid={errors.content ? true : undefined}
            placeholder="Enter your contract text here. Use {{merge_field}} for dynamic values." />
          {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available merge fields</p>
          <p className="text-xs text-muted-foreground">Type these tokens in your template. They will be replaced with actual data when a contract is generated.</p>
          <div className="space-y-2">
            {MERGE_FIELDS.map((f) => (
              <div key={f.key}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => {
                  const token = `{{${f.key}}}`;
                  navigator.clipboard?.writeText(token).then(() => toast.success(`Copied ${token}`)).catch(() => {});
                }}>
                <p className="font-mono text-xs font-medium text-primary">{`{{${f.key}}}`}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Click any field to copy it to your clipboard.</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <LibrarySaveStatus status={pending ? "saving" : dirty ? "dirty" : "idle"} model="explicit" className="mr-auto" />
        <Button type="button" variant="outline" onClick={() => { if (confirmLeave()) router.back(); }} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={handleSubmit} disabled={pending || (isEdit && !dirty)}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : isEdit ? "Save changes" : "Create template"}
        </Button>
      </div>
    </div>
  );
}
