"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelContractAction,
  createAmendmentFromContractAction,
  deleteContractAction,
  finalizeContractAction,
  getContractPdfUrlAction,
  reopenContractForEditingAction,
  resendContractAction,
  sendContractAction,
  updateContractContentAction,
} from "@/app/(app)/contracts/actions";
import { ContractStatusBadge } from "@/components/contracts/contract-status-badge";
import { BusinessAssetActionRow, BusinessAssetHeader } from "@/components/business-assets/asset-header";
import type { WaitingOn } from "@/components/business-assets/waiting-state";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatContractDate } from "@/lib/contracts/constants";
import type { ContractStatus, ContractWithDetails } from "@/lib/contracts/types";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";

// Whose turn — draft is on the venue to send, sent is on the client to
// sign, signed is done. Same "whose turn" question Questionnaires and
// Messaging already answer, generalized here (BA4, Step 1C).
const CONTRACT_WAITING_ON: Record<ContractStatus, WaitingOn> = {
  draft: "venue", sent: "client", signed: "completed", cancelled: "none", expired: "none",
};

export function ContractDetail({ contract, finalized, venueName }: { contract: ContractWithDetails; finalized: boolean; venueName: string }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(contract.title);
  const [editContent, setEditContent] = React.useState(contract.content);
  const [savePending, startSave] = React.useTransition();
  const [cancelPending, startCancel] = React.useTransition();
  const [deletePending, startDelete] = React.useTransition();
  const [reopenPending, startReopen] = React.useTransition();
  const [finalizePending, startFinalize] = React.useTransition();
  const [pdfPending, startPdf] = React.useTransition();
  const [amendPending, startAmend] = React.useTransition();
  const [copied, setCopied] = React.useState(false);

  const signUrl = typeof window !== "undefined"
    ? `${window.location.origin}/sign/${contract.signToken}`
    : `/sign/${contract.signToken}`;

  // Work Package D5E — the unified Share experience. Recipient/explanation/
  // default message are the only contract-specific inputs; the actual send
  // still goes through sendContract()/resendContract() exactly as before —
  // ShareDialog is presentation only.
  const shareRecipient = { name: contract.clientName ?? "the client", contact: contract.clientEmail, relationshipLabel: "Client" };
  const shareMergeData = buildMergeData({ venueName, clientName: contract.clientName ?? "", coordinatorName: venueName, eventDate: contract.eventDate });
  const shareDefaultMessage = mergeContent(
    `{{venue_name}} has sent you "${contract.title}" to review and sign.`,
    shareMergeData,
  );

  function handleSaveEdit() {
    startSave(async () => {
      // Work Package D4 — carries the version of the row this editor
      // actually loaded (contract.updatedAt, from the page's own props,
      // not re-read at save time) so the server can detect a stale write.
      const result = await updateContractContentAction(contract.id, editTitle, editContent, contract.updatedAt);
      if (result.ok) { toast.success("Contract updated."); setEditing(false); router.refresh(); return; }
      if (result.reason === "stale") {
        // A real conflict, not a generic error — someone else's save won.
        // Never silently overwrite it: leave editing mode with the
        // server's fresh copy, exactly what the brief's own example
        // message promises ("review the latest version before saving").
        toast.error(result.message, { duration: 8000 });
        setEditing(false);
        router.refresh();
        return;
      }
      toast.error(result.message ?? "Could not save.");
    });
  }

  function handleCancel() {
    if (!confirm("Cancel and void this contract? This cannot be undone.")) return;
    startCancel(async () => {
      const result = await cancelContractAction(contract.id);
      if (result.ok) { toast.success("Contract cancelled."); router.refresh(); }
      else toast.error(result.message);
    });
  }

  function handleDelete() {
    if (!confirm("Permanently delete this contract?")) return;
    startDelete(async () => {
      const result = await deleteContractAction(contract.id);
      if (result.ok) { toast.success("Contract deleted."); router.push("/contracts"); }
      else toast.error(result.message);
    });
  }

  function handleReopen() {
    // Work Package D4 — reverts a sent-but-unsigned contract back to
    // draft so the venue can edit it; the client's old link becomes
    // stale until it's resent. Confirm because it un-does "waiting on
    // client" state the venue may not have meant to disturb.
    if (!confirm("Reopen this contract for editing? You'll need to resend it to your client afterward.")) return;
    startReopen(async () => {
      const result = await reopenContractForEditingAction(contract.id);
      if (result.ok) { toast.success("Contract reopened for editing."); router.refresh(); }
      else toast.error(result.message ?? "Could not reopen contract.");
    });
  }

  function handleFinalize() {
    // Explicit, separate step from signing itself (Step 31) — this is
    // what actually locks the signed content and produces the real PDF
    // final representation via the Document Domain.
    if (!confirm("Finalize this contract? This locks the signed agreement and generates the official final PDF. This cannot be undone.")) return;
    startFinalize(async () => {
      const result = await finalizeContractAction(contract.id);
      if (result.ok) { toast.success("Contract finalized."); router.refresh(); }
      else toast.error(result.message ?? "Could not finalize contract.");
    });
  }

  function handleDownloadPdf() {
    startPdf(async () => {
      const result = await getContractPdfUrlAction(contract.id);
      if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer");
      else toast.error(result.message ?? "Could not open the final contract.");
    });
  }

  function handleCreateAmendment() {
    startAmend(async () => {
      const result = await createAmendmentFromContractAction(contract.id);
      if (result.ok) { toast.success("Amendment created as a new draft."); router.push(`/contracts/${result.contractId}`); }
      else toast.error(result.message ?? "Could not create amendment.");
    });
  }

  function copyLink() {
    navigator.clipboard?.writeText(signUrl).then(() => {
      setCopied(true);
      toast.success("Signing link copied.");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const expiry = contract.expiresAt ? (() => {
    const days = Math.floor((new Date(contract.expiresAt + "T12:00:00").getTime() - Date.now()) / 86_400_000);
    const expired = days < 0;
    return { expired, text: expired ? `Expired ${Math.abs(days)}d ago` : `Expires ${formatContractDate(contract.expiresAt!)}`, soon: !expired && days <= 14 };
  })() : null;

  return (
    <div className="space-y-6">
      <BusinessAssetHeader
        backHref="/contracts"
        backLabel="Contracts"
        whatIsThis="Contract"
        title={contract.title}
        status={
          <div className="flex items-center gap-1.5">
            <ContractStatusBadge status={contract.status} />
            {/* Finalized is a fact derived from the Document Domain (isContractFinalized),
                deliberately never re-derived from contract.status alone — "signed" and
                "finalized" are different moments in the D4 lifecycle and must never be
                conflated in the UI even though both currently only ever apply to signed contracts. */}
            {finalized && (
              <Badge variant="success"><Lock className="mr-1 h-3 w-3" />Finalized</Badge>
            )}
          </div>
        }
        waitingOn={CONTRACT_WAITING_ON[contract.status]}
        lastUpdated={formatContractDate(contract.updatedAt.slice(0, 10))}
        relationship={contract.clientName ? { name: contract.clientName, href: `/clients/${contract.clientId}` } : null}
        primaryAction={
          contract.status === "draft" ? (
            <ShareDialog
              trigger={<Button size="sm"><Send className="mr-1 h-3.5 w-3.5" />Send for Signing</Button>}
              title="Share Contract"
              recipient={shareRecipient}
              whatHappensNext="They'll review and sign the contract."
              defaultMessage={shareDefaultMessage}
              sendLabel="Send for Signing"
              onSend={async (message) => sendContractAction(contract.id, message)}
              onSent={() => router.refresh()}
            />
          ) : contract.status === "sent" ? (
            <ShareDialog
              trigger={<Button size="sm" variant="outline"><RotateCcw className="mr-1 h-3.5 w-3.5" />Resend</Button>}
              title="Resend Contract"
              recipient={shareRecipient}
              whatHappensNext="They'll get another copy of the same signing link — nothing about the contract changes."
              defaultMessage={shareDefaultMessage}
              sendLabel="Resend"
              onSend={async (message) => resendContractAction(contract.id, message)}
              onSent={() => router.refresh()}
            />
          ) : contract.status === "signed" && !finalized ? (
            <Button size="sm" onClick={handleFinalize} disabled={finalizePending}>
              {finalizePending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Finalizing…</> : <><Lock className="mr-1 h-3.5 w-3.5" />Finalize Contract</>}
            </Button>
          ) : finalized ? (
            <Button size="sm" onClick={handleDownloadPdf} disabled={pdfPending}>
              {pdfPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Opening…</> : <><Download className="mr-1 h-3.5 w-3.5" />Download Final PDF</>}
            </Button>
          ) : null
        }
      />
      {expiry && (
        <p className={`text-xs ${expiry.expired ? "text-destructive font-medium" : expiry.soon ? "text-warning-foreground font-medium" : "text-muted-foreground"}`}>{expiry.text}</p>
      )}
      <BusinessAssetActionRow
        secondary={<>
          {contract.status === "draft" && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {contract.status === "sent" && (
            <Button variant="outline" size="sm" onClick={handleReopen} disabled={reopenPending}>
              {reopenPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Reopening…</> : <><RotateCcw className="mr-1 h-3.5 w-3.5" />Reopen for Editing</>}
            </Button>
          )}
          {finalized && (
            <Button variant="outline" size="sm" onClick={handleCreateAmendment} disabled={amendPending}>
              {amendPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Creating…</> : <><FilePlus2 className="mr-1 h-3.5 w-3.5" />Create Amendment</>}
            </Button>
          )}
          {["draft", "sent"].includes(contract.status) && (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
              onClick={handleCancel} disabled={cancelPending}>
              <X className="mr-1 h-3.5 w-3.5" />{cancelPending ? "Cancelling…" : "Cancel"}
            </Button>
          )}
          {contract.status === "cancelled" && (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
              onClick={handleDelete} disabled={deletePending}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />Delete
            </Button>
          )}
        </>}
      />

      {/* Amendment lineage — this contract was cloned from an earlier finalized one (Step 33). */}
      {contract.amendsContractId && (
        <p className="text-xs text-muted-foreground">
          This is an amendment of{" "}
          <a href={`/contracts/${contract.amendsContractId}`} className="underline hover:text-foreground">
            an earlier contract
          </a>. The original remains unchanged and preserved.
        </p>
      )}

      {/* Signing link banner (sent state) */}
      {contract.status === "sent" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <p className="mb-2 text-sm font-medium text-heading">Share this link with your client to sign:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground">
                {signUrl}
              </code>
              <Button size="sm" variant="outline" onClick={copyLink}>
                {copied ? <><Check className="mr-1 h-3.5 w-3.5 text-success" />Copied</> : <><Copy className="mr-1 h-3.5 w-3.5" />Copy</>}
              </Button>
              <Button size="sm" variant="ghost" render={<a href={signUrl} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signed state */}
      {contract.status === "signed" && (
        <Card className="border-success/25 bg-success/5">
          <CardContent className="py-4 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                Signed by {contract.signerName} on {contract.signedAt ? formatContractDate(contract.signedAt.slice(0, 10)) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {finalized ? "This agreement is finalized. The final PDF is the official record." : "Finalize this contract to lock the signed content and generate the official final PDF."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract document */}
      {editing ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Edit Contract{contract.clientName ? ` — ${contract.clientName}` : ""}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setEditTitle(contract.title); setEditContent(contract.content); }}>Cancel</Button>
                <Button type="button" size="sm" disabled={savePending} onClick={handleSaveEdit}>
                  {savePending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Contract title" />
            </div>
            <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={28} className="font-mono text-sm" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract Document</CardTitle>
            <CardDescription>
              {finalized
                ? "This is a copy of the signed content. The final PDF (above) is the official record."
                : contract.status === "signed"
                  ? "Signed agreement — not yet finalized."
                  : "Review before sending for signature."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-background p-6 font-sans text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {contract.content}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity */}
      {contract.activities.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
          <CardContent>
            <ActivityTimeline activities={contract.activities} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
