"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { createTemplateAction, importTemplateAction, updateTemplateAction } from "@/app/(app)/communication/templates/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGE_MERGE_FIELDS, MESSAGE_TEMPLATE_CATEGORIES } from "@/lib/message-templates/constants";
import type { MessageTemplate, MessageTemplateErrors, MessageTemplateInput } from "@/lib/message-templates/types";
import type { ImportChannel } from "@/lib/luv/message-template-import";

function buildInitial(template?: MessageTemplate | null): MessageTemplateInput {
  return {
    name: template?.name ?? "",
    category: template?.category ?? "general",
    emailSubject: template?.emailSubject ?? "",
    emailBody: template?.emailBody ?? "",
    smsBody: template?.smsBody ?? "",
  };
}

// A template belongs to Email, SMS, or both — content is always
// independently written per channel, never shared (§2.5, decided
// 2026-07-13). Both sections are always visible; saving only requires at
// least one to actually have content.
export function TemplateForm({ template }: { template?: MessageTemplate | null }) {
  const router = useRouter();
  const isEdit = !!template;
  const [input, setInput] = React.useState<MessageTemplateInput>(() => buildInitial(template));
  const [errors, setErrors] = React.useState<MessageTemplateErrors>({});
  const [pending, startTransition] = React.useTransition();

  const [importOpen, setImportOpen] = React.useState(false);
  const [importText, setImportText] = React.useState("");
  const [importChannel, setImportChannel] = React.useState<ImportChannel>("both");
  const [importing, startImport] = React.useTransition();

  const set = <K extends keyof MessageTemplateInput>(key: K, v: MessageTemplateInput[K]) => {
    setInput((p) => ({ ...p, [key]: v }));
    setErrors((p) => { const n = { ...p }; delete n[key as string]; return n; });
  };

  function handleImport() {
    if (!importText.trim()) return;
    startImport(async () => {
      const result = await importTemplateAction(importText, importChannel, input.category);
      if (result.ok) {
        setInput((p) => ({
          ...p,
          name: p.name.trim() || result.name,
          emailSubject: result.emailSubject || p.emailSubject,
          emailBody: result.emailBody || p.emailBody,
          smsBody: result.smsBody || p.smsBody,
        }));
        setImportOpen(false);
        setImportText("");
        toast.success("Luv proposed a template below — review it before saving.");
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = isEdit
        ? await updateTemplateAction(template!.id, input)
        : await createTemplateAction(input);
      if (result.ok) {
        toast.success(isEdit ? "Template updated." : "Template created.");
        router.push("/communication/templates");
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  function copyToken(key: string) {
    const token = `{{${key}}}`;
    navigator.clipboard?.writeText(token).then(() => toast.success(`Copied ${token}`)).catch(() => {});
  }

  return (
    <div className="space-y-6">
      {!isEdit && (
        <div className="rounded-lg border border-dashed border-border p-4">
          {!importOpen ? (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Sparkles className="h-4 w-4" />
              Paste an existing message instead
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-heading">Paste a message you already send</p>
                <button type="button" onClick={() => setImportOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Luv will organize it into the fields below for you to review — nothing is saved until you click Create.
              </p>
              <Textarea
                value={importText} onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste your existing email or text message here…"
                className="min-h-28 text-sm"
              />
              <div className="flex items-center gap-3">
                <Select value={importChannel} onValueChange={(v) => setImportChannel(v as ImportChannel)}
                  items={[{ value: "both", label: "Email + SMS" }, { value: "email", label: "Email only" }, { value: "sms", label: "SMS only" }]}>
                  <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Email + SMS</SelectItem>
                    <SelectItem value="email">Email only</SelectItem>
                    <SelectItem value="sms">SMS only</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={handleImport} disabled={importing || !importText.trim()}>
                  {importing ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Reading…</> : "Propose with Luv"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tn">Template name *</Label>
          <Input id="tn" value={input.name} onChange={(e) => set("name", e.target.value)}
            placeholder="New Inquiry Reply" aria-invalid={errors.name ? true : undefined} />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tcat">Category</Label>
          <Select value={input.category} onValueChange={(v) => set("category", v as MessageTemplateInput["category"])} items={MESSAGE_TEMPLATE_CATEGORIES}>
            <SelectTrigger id="tcat" className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESSAGE_TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-semibold text-heading">Email</p>
            <div className="space-y-1.5">
              <Label htmlFor="tes">Subject</Label>
              <Input id="tes" value={input.emailSubject} onChange={(e) => set("emailSubject", e.target.value)}
                placeholder="Thanks for reaching out!" aria-invalid={errors.emailSubject ? true : undefined} />
              {errors.emailSubject && <p className="text-xs text-destructive">{errors.emailSubject}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teb">Body</Label>
              <Textarea id="teb" value={input.emailBody} onChange={(e) => set("emailBody", e.target.value)}
                rows={10} className="text-sm" aria-invalid={errors.emailBody ? true : undefined}
                placeholder="Hi {{client_name}}, thank you for your interest in {{venue_name}}…" />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-heading">SMS</p>
              <p className="text-xs text-muted-foreground">{input.smsBody.length} characters</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tsb">Body</Label>
              <Textarea id="tsb" value={input.smsBody} onChange={(e) => set("smsBody", e.target.value)}
                rows={4} className="text-sm" aria-invalid={errors.smsBody ? true : undefined}
                placeholder="Hi {{client_name}}, this is {{venue_name}} — thanks for reaching out!" />
            </div>
          </div>
          {errors.emailBody && !errors.emailSubject && (
            <p className="text-xs text-destructive">{errors.emailBody}</p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Merge fields</p>
          <p className="text-xs text-muted-foreground">Same fields work in Email and SMS. They&apos;re replaced with real data when a message is sent.</p>
          <div className="space-y-2">
            {MESSAGE_MERGE_FIELDS.map((f) => (
              <div key={f.key}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => copyToken(f.key)}>
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
