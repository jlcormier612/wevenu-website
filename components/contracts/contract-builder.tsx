"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import {
  createContractAction,
  previewContractContentAction,
  sendContractAction,
  updateContractContentAction,
} from "@/app/(app)/contracts/actions";
import { ArtifactReviewOverlay } from "@/components/artifacts/artifact-review-overlay";
import { ContractSigningArtifact } from "@/components/contracts/contract-signing-artifact";
import { SignForm } from "@/app/sign/[token]/sign-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clientDisplayName } from "@/lib/clients/constants";
import type { Client } from "@/lib/clients/types";
import { DEFERRED_MERGE_FIELD_KEYS, MERGE_FIELDS } from "@/lib/contracts/constants";
import type { ContractErrors, ContractTemplate } from "@/lib/contracts/types";
import type { ClientContact } from "@/lib/contacts/types";
import type { ContractSigner } from "@/lib/contracts/signers";
import type { ContractBrandingSnapshot } from "@/lib/contracts/branding";
import { resolveContractBrandPresentation } from "@/lib/contracts/branding";
import {
  buildSignerCandidates,
  defaultSelectedSignerIds,
  selectedIdsFromExistingSigners,
} from "@/lib/contracts/signer-candidates";

export type ContractBuilderDraft = {
  contractId: string;
  title: string;
  content: string;
  clientId: string | null;
  eventId: string;
  clientName: string | null;
  expectedUpdatedAt: string;
  selectionId?: string;
};

export function ContractBuilder({
  mode,
  templates,
  clients,
  contactsByClientId = {},
  initialTemplateId,
  initialClientId,
  initialEventId,
  selectionId,
  selectionSummary,
  draft,
  signers = [],
  venueBrand = null,
}: {
  mode: "create" | "draft";
  templates: ContractTemplate[];
  clients: Client[];
  contactsByClientId?: Record<string, ClientContact[]>;
  initialTemplateId?: string;
  initialClientId?: string;
  initialEventId?: string;
  selectionId?: string;
  selectionSummary?: { name: string; totalAmount: number; depositAmount: number } | null;
  draft?: ContractBuilderDraft;
  signers?: ContractSigner[];
  venueBrand?: ContractBrandingSnapshot | null;
}) {
  const router = useRouter();
  const contentRef = React.useRef<HTMLTextAreaElement>(null);

  const requestedTemplate = initialTemplateId
    ? templates.find((t) => t.id === initialTemplateId && !t.isArchived)
    : undefined;
  const activeTemplates = templates.filter((t) => !t.isArchived);
  const defaultTemplate = requestedTemplate ?? activeTemplates.find((t) => t.isDefault) ?? activeTemplates[0];

  const [templateId, setTemplateId] = React.useState(draft ? ("") : (defaultTemplate?.id ?? ""));
  const [clientId, setClientId] = React.useState(draft?.clientId ?? initialClientId ?? "");
  const [eventId] = React.useState(draft?.eventId ?? initialEventId ?? "");
  const [title, setTitle] = React.useState(draft?.title ?? "");
  const [content, setContent] = React.useState(draft?.content ?? defaultTemplate?.content ?? "");
  const [expectedUpdatedAt, setExpectedUpdatedAt] = React.useState(draft?.expectedUpdatedAt ?? "");
  const [errors, setErrors] = React.useState<ContractErrors>({});
  const [selectedSignerIds, setSelectedSignerIds] = React.useState<string[]>([]);
  const [signersInitialized, setSignersInitialized] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [previewPending, startPreview] = React.useTransition();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewContent, setPreviewContent] = React.useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [releaseMessage, setReleaseMessage] = React.useState("");
  const [sendPending, startSend] = React.useTransition();

  React.useEffect(() => {
    if (mode !== "create" || !initialClientId || title) return;
    const c = clients.find((x) => x.id === initialClientId);
    if (c) {
      const name = clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName);
      setTitle(`Venue Rental Agreement — ${name}`);
    }
  }, [mode, initialClientId, clients, title]);

  const associatedClient = clients.find((c) => c.id === clientId) ?? null;
  const clientContacts = clientId ? (contactsByClientId[clientId] ?? []) : [];
  const signerCandidates = React.useMemo(
    () => (associatedClient ? buildSignerCandidates(associatedClient, clientContacts) : []),
    [associatedClient, clientContacts],
  );

  React.useEffect(() => {
    if (!clientId || !associatedClient) {
      setSelectedSignerIds([]);
      setSignersInitialized(false);
      return;
    }
    if (mode === "draft" && signers.length > 0 && !signersInitialized) {
      setSelectedSignerIds(selectedIdsFromExistingSigners(signerCandidates, signers));
      setSignersInitialized(true);
      return;
    }
    if (mode === "create" && !signersInitialized) {
      setSelectedSignerIds(defaultSelectedSignerIds(signerCandidates));
      setSignersInitialized(true);
    }
  }, [clientId, associatedClient, mode, signers, signerCandidates, signersInitialized]);

  const associatedClientLabel = associatedClient
    ? clientDisplayName(associatedClient.firstName, associatedClient.lastName, associatedClient.partnerFirstName, associatedClient.partnerLastName)
    : draft?.clientName ?? "this client";

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const t = activeTemplates.find((x) => x.id === id);
    if (t) setContent(t.content);
  }

  function handleClientChange(id: string) {
    setClientId(id);
    setSignersInitialized(false);
    setSelectedSignerIds([]);
    const c = clients.find((x) => x.id === id);
    if (c && !title) {
      const name = clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName);
      setTitle(`Venue Rental Agreement — ${name}`);
    }
  }

  function toggleSigner(candidateId: string) {
    setSelectedSignerIds((prev) => {
      if (prev.includes(candidateId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== candidateId);
      }
      return [...prev, candidateId];
    });
  }

  function insertSmartField(key: string) {
    if ((DEFERRED_MERGE_FIELD_KEYS as readonly string[]).includes(key)) return;
    const token = `{{${key}}}`;
    const el = contentRef.current;
    if (!el) {
      setContent((c) => `${c}${token}`);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function resolvePreview(): Promise<string | null> {
    if (!clientId) {
      toast.error("Select a client to preview with their details.");
      return null;
    }
    if (selectedSignerIds.length === 0) {
      toast.error("Select at least one required client signer with an email.");
      return null;
    }
    const result = await previewContractContentAction({
      templateContent: content,
      clientId,
      eventId,
      contractTitle: title,
      clientSignerContactIds: selectedSignerIds,
      selectionId: draft?.selectionId ?? selectionId,
    });
    if (!result.ok) {
      toast.error(result.message);
      return null;
    }
    return result.content;
  }

  function handlePreview() {
    startPreview(async () => {
      const resolved = await resolvePreview();
      if (resolved == null) return;
      setPreviewContent(resolved);
      setPreviewOpen(true);
    });
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreviewContent(null);
  }

  function handleSaveDraft() {
    if (mode === "create") {
      const client = clients.find((c) => c.id === clientId);
      const template = activeTemplates.find((t) => t.id === templateId);
      const clientLabel = client
        ? clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName)
        : "this client";
      if (selectedSignerIds.length === 0) {
        toast.error("Select at least one required client signer with an email.");
        return;
      }
      const confirmed = confirm(
        `Save a draft contract for ${clientLabel}?\n\nTemplate: ${template?.name ?? "—"}\n\n`
        + "Smart Fields stay in the draft until you send. This does not email the client or request a signature.",
      );
      if (!confirmed) return;
      startTransition(async () => {
        const result = await createContractAction({
          templateId,
          clientId,
          eventId,
          title,
          content,
          clientSignerContactIds: selectedSignerIds,
          selectionId,
        });
        if (result.ok) {
          toast.success("Draft saved.");
          router.push(`/contracts/${result.contractId}`);
          return;
        }
        if (result.errors) setErrors(result.errors);
        toast.error(result.message ?? "Please fix the highlighted fields.");
      });
      return;
    }

    if (!draft) return;
    if (selectedSignerIds.length === 0) {
      toast.error("Select at least one required client signer with an email.");
      return;
    }
    startTransition(async () => {
      const result = await updateContractContentAction(
        draft.contractId,
        title,
        content,
        expectedUpdatedAt,
        selectedSignerIds,
      );
      if (result.ok) {
        if (result.updatedAt) setExpectedUpdatedAt(result.updatedAt);
        toast.success("Draft saved.");
        router.refresh();
        return;
      }
      if (result.reason === "stale") {
        toast.error(result.message, { duration: 8000 });
        router.refresh();
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Could not save.");
    });
  }

  function handleReviewAndSend() {
    if (!draft) return;
    if (selectedSignerIds.length === 0) {
      toast.error("Select at least one required client signer with an email.");
      return;
    }
    startPreview(async () => {
      const save = await updateContractContentAction(
        draft.contractId,
        title,
        content,
        expectedUpdatedAt,
        selectedSignerIds,
      );
      if (!save.ok) {
        if (save.reason === "stale") {
          toast.error(save.message, { duration: 8000 });
          router.refresh();
          return;
        }
        toast.error(save.message ?? "Save the draft before sending.");
        return;
      }
      if (save.updatedAt) setExpectedUpdatedAt(save.updatedAt);
      const resolved = await resolvePreview();
      if (resolved == null) return;
      setPreviewContent(resolved);
      setReleaseMessage("");
      setReviewOpen(true);
    });
  }

  function handleSend() {
    if (!draft) return;
    startSend(async () => {
      const result = await sendContractAction(draft.contractId, releaseMessage);
      if (result.ok) {
        toast.success("Contract sent to the client for review.");
        setReviewOpen(false);
        router.refresh();
        return;
      }
      toast.error(result.message ?? "Could not send to the client.");
    });
  }

  const brand = resolveContractBrandPresentation(null, venueBrand);
  const showSignerConfig = Boolean(clientId && associatedClient);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl text-heading">Contract Builder</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the agreement with Smart Fields intact. Preview is display-only and never changes your draft.
          Tokens resolve only when you send the contract to the client.
        </p>
      </div>

      {selectionSummary && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected Package</p>
          <p className="mt-1 font-medium text-heading">{selectionSummary.name}</p>
          <p className="text-heading">${selectionSummary.totalAmount.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {selectionSummary.depositAmount > 0
              ? `Deposit $${selectionSummary.depositAmount.toFixed(2)}. This package fills into Smart Fields on preview and send.`
              : "This package fills into Smart Fields on preview and send."}
          </p>
        </div>
      )}

      {mode === "create" && (
        <div className="space-y-1.5">
          <Label htmlFor="cb-tmpl">Template</Label>
          <Select
            value={templateId}
            onValueChange={handleTemplateChange}
            items={activeTemplates.map((t) => ({ value: t.id, label: `${t.name}${t.isDefault ? " (default)" : ""}` }))}
          >
            <SelectTrigger id="cb-tmpl"><SelectValue placeholder="Select a template" /></SelectTrigger>
            <SelectContent>
              {activeTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}{t.isDefault ? " (default)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {mode === "create" ? (
        <div className="space-y-1.5">
          <Label htmlFor="cb-client">Client *</Label>
          <Select
            value={clientId}
            onValueChange={handleClientChange}
            items={clients.map((c) => ({ value: c.id, label: clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName) }))}
          >
            <SelectTrigger id="cb-client" aria-invalid={errors.clientId ? true : undefined}>
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
      ) : (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Client</p>
          <p className="mt-1 font-medium text-heading">{associatedClientLabel}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Preview and send resolve Smart Fields from this associated client. Historical identity on this contract stays with this record.
          </p>
        </div>
      )}

      {showSignerConfig && (
        <div className="space-y-2 rounded-md border p-4" data-testid="required-client-signers">
          <Label>Required client signers</Label>
          <p className="text-xs text-muted-foreground">
            Choose who must sign. Each selected person needs their own email and receives their own signing link.
            A multi-person relationship is never treated as one signer. Default is the primary contact only — we never assume a couple needs two signers.
          </p>
          {signerCandidates.length === 0 ? (
            <p className="text-sm text-destructive">
              No people with emails are on this client relationship yet. Add an email on the client record (and partner email if both should sign).
            </p>
          ) : (
            <div className="space-y-2">
              {signerCandidates.map((c) => {
                const checked = selectedSignerIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-start gap-2 text-sm ${c.selectable ? "" : "opacity-60"}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!c.selectable}
                      onCheckedChange={() => {
                        if (!c.selectable) return;
                        toggleSigner(c.id);
                      }}
                      className="mt-0.5"
                    />
                    <span>
                      {c.name}
                      {c.email ? (
                        <span className="text-muted-foreground"> · {c.email}</span>
                      ) : (
                        <span className="text-destructive"> · add an email to require their signature</span>
                      )}
                      {c.roleLabel ? (
                        <span className="text-muted-foreground"> · {c.roleLabel}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cb-title">Contract title *</Label>
        <Input
          id="cb-title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setErrors((p) => { const n = { ...p }; delete n.title; return n; }); }}
          placeholder="Venue Rental Agreement — Client Name"
          aria-invalid={errors.title ? true : undefined}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="flex min-h-0 flex-col gap-1.5 lg:col-span-2">
          <Label htmlFor="cb-content">Contract content</Label>
          <p className="text-xs text-muted-foreground">
            Smart Fields stay as {`{{tokens}}`} in this draft. Preview fills them from the associated client without changing this text.
          </p>
          <Textarea
            id="cb-content"
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[min(70svh,52rem)] flex-1 resize-y font-mono text-sm"
            aria-invalid={errors.content ? true : undefined}
          />
        </div>
        <div className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Smart Fields</p>
          <p className="text-xs text-muted-foreground">
            Click to insert a field at the cursor. Only values with a source at contract time are listed. They resolve on Preview and Send — not while you edit.
          </p>
          <div className="space-y-2">
            {MERGE_FIELDS.map((f) => (
              <button
                key={f.key}
                type="button"
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-left hover:border-primary/40 transition-colors"
                onClick={() => insertSmartField(f.key)}
              >
                <p className="font-mono text-xs font-medium text-primary">{`{{${f.key}}}`}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {mode === "create" && (
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="button" variant="outline" onClick={handlePreview} disabled={previewPending || !clientId}>
          {previewPending && !reviewOpen ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Previewing…</> : "Preview"}
        </Button>
        <Button type="button" onClick={handleSaveDraft} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : "Save draft"}
        </Button>
        {mode === "draft" && (
          <Button type="button" onClick={handleReviewAndSend} disabled={previewPending || sendPending}>
            {previewPending && reviewOpen ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Preparing…</> : <><Send className="mr-1 h-3.5 w-3.5" />Review &amp; send to client</>}
          </Button>
        )}
      </div>

      <ArtifactReviewOverlay
        open={previewOpen}
        eyebrow="Preview — display only"
        title={title || "Contract preview"}
        onBack={closePreview}
      >
        <ContractSigningArtifact
          title={title || "Contract preview"}
          content={previewContent ?? ""}
          brand={brand}
          signatureSlot={<SignForm preview />}
        />
      </ArtifactReviewOverlay>

      {mode === "draft" && draft && (
        <ArtifactReviewOverlay
          open={reviewOpen}
          eyebrow="Customer-facing agreement"
          title={title || draft.title}
          onBack={() => { setReviewOpen(false); }}
          primary={
            <Button size="sm" onClick={handleSend} disabled={sendPending}>
              {sendPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send to Client"
              )}
            </Button>
          }
          footer={
            <div className="space-y-2">
              <Label htmlFor="contract-release-message" className="text-xs text-muted-foreground">
                Message to the couple (optional)
              </Label>
              <Textarea
                id="contract-release-message"
                value={releaseMessage}
                onChange={(e) => setReleaseMessage(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
          }
        >
          <ContractSigningArtifact
            title={title || draft.title}
            content={previewContent ?? ""}
            brand={brand}
            signatureSlot={<SignForm preview />}
          />
        </ArtifactReviewOverlay>
      )}
    </div>
  );
}
