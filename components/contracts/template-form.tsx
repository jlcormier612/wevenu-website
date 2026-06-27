"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createTemplateAction, updateTemplateAction } from "@/app/(app)/contracts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MERGE_FIELDS } from "@/lib/contracts/constants";
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
  const isEdit = !!template;
  const [input, setInput] = React.useState<TemplateInput>(() => buildInitial(template));
  const [errors, setErrors] = React.useState<ContractErrors>({});
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof TemplateInput>(key: K, v: TemplateInput[K]) => {
    setInput((p) => ({ ...p, [key]: v }));
    setErrors((p) => { const n = { ...p }; delete n[key as string]; return n; });
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = isEdit
        ? await updateTemplateAction(template!.id, input)
        : await createTemplateAction(input);
      if (result.ok) {
        toast.success(isEdit ? "Template updated." : "Template created.");
        router.push("/contracts/templates");
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tn">Template name *</Label>
          <Input id="tn" value={input.name} onChange={(e) => set("name", e.target.value)}
            placeholder="Standard Venue Rental Agreement" aria-invalid={errors.name ? true : undefined} />
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
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : isEdit ? "Save changes" : "Create template"}
        </Button>
      </div>
    </div>
  );
}
