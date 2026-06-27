"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  createContractAction,
  previewMergedContentAction,
} from "@/app/(app)/contracts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { clientDisplayName } from "@/lib/clients/constants";
import type { Client } from "@/lib/clients/types";
import type { ContractErrors, ContractTemplate } from "@/lib/contracts/types";

export function NewContractForm({
  templates,
  clients,
}: {
  templates: ContractTemplate[];
  clients: Client[];
}) {
  const router = useRouter();
  const defaultTemplate = templates.find((t) => t.isDefault) ?? templates[0];

  const [templateId, setTemplateId] = React.useState(defaultTemplate?.id ?? "");
  const [clientId, setClientId] = React.useState("");
  const [eventId, setEventId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState(defaultTemplate?.content ?? "");
  const [errors, setErrors] = React.useState<ContractErrors>({});
  const [pending, startTransition] = React.useTransition();
  const [merging, startMerge] = React.useTransition();

  // Update content when template changes
  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const t = templates.find((t) => t.id === id);
    if (t) setContent(t.content);
  }

  // Auto-suggest title when client is selected
  function handleClientChange(id: string) {
    setClientId(id);
    const c = clients.find((c) => c.id === id);
    if (c && !title) {
      const name = clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName);
      setTitle(`Venue Rental Agreement — ${name}`);
    }
  }

  function handleMerge() {
    if (!templateId) return;
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    startMerge(async () => {
      const result = await previewMergedContentAction({
        templateContent: template.content,
        clientId,
        eventId,
        contractTitle: title,
      });
      if (result.ok) {
        setContent(result.content);
        toast.success("Merge fields applied.");
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createContractAction({ templateId, clientId, eventId, title, content });
      if (result.ok) { toast.success("Contract created."); router.push(`/contracts/${result.contractId}`); return; }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  // Selected client's events (for event select — in Sprint 15, just show a text input)
  // We don't have a client→events join here. Omit event select for now.

  return (
    <div className="space-y-6">
      {/* Template */}
      <div className="space-y-1.5">
        <Label htmlFor="nc-tmpl">Template</Label>
        <Select value={templateId} onValueChange={handleTemplateChange}>
          <SelectTrigger id="nc-tmpl"><SelectValue placeholder="Select a template" /></SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}{t.isDefault ? " (default)" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Client */}
      <div className="space-y-1.5">
        <Label htmlFor="nc-client">Client *</Label>
        <Select value={clientId} onValueChange={handleClientChange}>
          <SelectTrigger id="nc-client" aria-invalid={errors.clientId ? true : undefined}>
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="nc-title">Contract title *</Label>
        <Input id="nc-title" value={title} onChange={(e) => { setTitle(e.target.value); setErrors((p) => { const n = {...p}; delete n.title; return n; }); }}
          placeholder="Venue Rental Agreement — Couple Name" aria-invalid={errors.title ? true : undefined} />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <Separator />

      {/* Contract content */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="nc-content">Contract content</Label>
          <Button type="button" variant="outline" size="sm" onClick={handleMerge} disabled={!clientId || merging}>
            {merging ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Applying…</> : <><RefreshCw className="mr-1 h-3.5 w-3.5" />Apply merge fields</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Select a client first, then click &quot;Apply merge fields&quot; to auto-fill merge tokens with their data. You can also edit freely.
        </p>
        <Textarea id="nc-content" value={content} onChange={(e) => setContent(e.target.value)}
          rows={20} className="font-mono text-sm" />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Creating…</> : "Create Contract"}
        </Button>
      </div>
    </div>
  );
}
