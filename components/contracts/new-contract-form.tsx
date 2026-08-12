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
import { Checkbox } from "@/components/ui/checkbox";
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
import type { ClientContact } from "@/lib/contacts/types";

export function NewContractForm({
  templates,
  clients,
  initialTemplateId,
  contactsByClientId = {},
}: {
  templates: ContractTemplate[];
  clients: Client[];
  /** Carried from the Contract Templates list's own "Use" button (Work Package D2). */
  initialTemplateId?: string;
  /** Preloaded contacts keyed by client id — never auto-selects all as signers. */
  contactsByClientId?: Record<string, ClientContact[]>;
}) {
  const router = useRouter();
  const requestedTemplate = initialTemplateId ? templates.find((t) => t.id === initialTemplateId && !t.isArchived) : undefined;
  const activeTemplates = templates.filter((t) => !t.isArchived);
  const defaultTemplate = requestedTemplate ?? activeTemplates.find((t) => t.isDefault) ?? activeTemplates[0];

  const [templateId, setTemplateId] = React.useState(defaultTemplate?.id ?? "");
  const [clientId, setClientId] = React.useState("");
  const [eventId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState(defaultTemplate?.content ?? "");
  const [errors, setErrors] = React.useState<ContractErrors>({});
  const [pending, startTransition] = React.useTransition();
  const [merging, startMerge] = React.useTransition();
  const [selectedSignerIds, setSelectedSignerIds] = React.useState<string[]>([]);

  const clientContacts = clientId ? (contactsByClientId[clientId] ?? []) : [];
  const selectableContacts = clientContacts.filter((c) => c.email?.trim());

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const t = activeTemplates.find((x) => x.id === id);
    if (t) setContent(t.content);
  }

  function handleClientChange(id: string) {
    setClientId(id);
    setSelectedSignerIds([]);
    const c = clients.find((x) => x.id === id);
    if (c && !title) {
      const name = clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName);
      setTitle(`Venue Rental Agreement — ${name}`);
    }
  }

  function toggleSigner(contactId: string) {
    setSelectedSignerIds((prev) =>
      prev.includes(contactId) ? prev.filter((x) => x !== contactId) : [...prev, contactId],
    );
  }

  function handleMerge() {
    if (!templateId) return;
    const template = activeTemplates.find((t) => t.id === templateId);
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
    const client = clients.find((c) => c.id === clientId);
    const template = activeTemplates.find((t) => t.id === templateId);
    const clientLabel = client ? clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName) : "this client";
    const confirmed = confirm(
      `Create a draft contract for ${clientLabel}?\n\nTemplate: ${template?.name ?? "—"}\n\n`
      + "This creates a working draft only. It does not email the client or request a signature — you'll sign as the venue, then release for signing from the contract page.",
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await createContractAction({
        templateId,
        clientId,
        eventId,
        title,
        content,
        clientSignerContactIds: selectedSignerIds.length > 0 ? selectedSignerIds : undefined,
      });
      if (result.ok) { toast.success("Contract created."); router.push(`/contracts/${result.contractId}`); return; }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="nc-tmpl">Template</Label>
        <Select
          value={templateId}
          onValueChange={handleTemplateChange}
          items={activeTemplates.map((t) => ({ value: t.id, label: `${t.name}${t.isDefault ? " (default)" : ""}` }))}
        >
          <SelectTrigger id="nc-tmpl"><SelectValue placeholder="Select a template" /></SelectTrigger>
          <SelectContent>
            {activeTemplates.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}{t.isDefault ? " (default)" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nc-client">Client *</Label>
        <Select
          value={clientId}
          onValueChange={handleClientChange}
          items={clients.map((c) => ({ value: c.id, label: clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName) }))}
        >
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

      {selectableContacts.length > 1 && (
        <div className="space-y-2 rounded-md border p-4">
          <Label>Required client signers</Label>
          <p className="text-xs text-muted-foreground">
            Choose who must sign this agreement. Leave unchecked to use the default primary contact only — the system never assumes a couple needs two signers.
          </p>
          <div className="space-y-2">
            {selectableContacts.map((c) => {
              const label = [c.firstName, c.lastName].filter(Boolean).join(" ");
              const checked = selectedSignerIds.includes(c.id);
              return (
                <label key={c.id} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSigner(c.id)}
                    className="mt-0.5"
                  />
                  <span>
                    {label}
                    <span className="text-muted-foreground"> · {c.email}</span>
                    {c.roleLabel || c.relationship ? (
                      <span className="text-muted-foreground"> · {c.roleLabel || c.relationship}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="nc-title">Contract title *</Label>
        <Input id="nc-title" value={title} onChange={(e) => { setTitle(e.target.value); setErrors((p) => { const n = {...p}; delete n.title; return n; }); }}
          placeholder="Venue Rental Agreement — Client Name" aria-invalid={errors.title ? true : undefined} />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="nc-content">Contract content</Label>
          <Button type="button" variant="outline" size="sm" onClick={handleMerge} disabled={!clientId || merging}>
            {merging ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Filling in…</> : <><RefreshCw className="mr-1 h-3.5 w-3.5" />Preview with {clientId ? "this client's" : "client"} details</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Client details fill in automatically when you create the contract. Select a client and click above to preview the real wording now, or just edit the text below directly.
        </p>
        <Textarea id="nc-content" value={content} onChange={(e) => setContent(e.target.value)}
          rows={20} className="font-mono text-sm" />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Creating…</> : "Create draft contract"}
        </Button>
      </div>
    </div>
  );
}
