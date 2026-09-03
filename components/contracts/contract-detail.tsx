"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
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
  venueSignContractAction,
  withdrawVenueSignatureAction,
} from "@/app/(app)/contracts/actions";
import { ContractStatusBadge } from "@/components/contracts/contract-status-badge";
import { BusinessAssetActionRow, BusinessAssetHeader } from "@/components/business-assets/asset-header";
import type { WaitingOn } from "@/components/business-assets/waiting-state";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatContractDate } from "@/lib/contracts/constants";
import { CONTRACT_SIGNATURE_CONSENT_TEXT, deriveContractSigningUiState } from "@/lib/contracts/signers";
import type { ContractStatus, ContractWithDetails } from "@/lib/contracts/types";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";

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
  const [venueSignPending, startVenueSign] = React.useTransition();
  const [withdrawPending, startWithdraw] = React.useTransition();
  const [venueSignerName, setVenueSignerName] = React.useState("");
  const [venueConsent, setVenueConsent] = React.useState(false);
  const [showVenueSign, setShowVenueSign] = React.useState(false);

  const signers = contract.signers ?? [];
  const venueSigner = signers.find((s) => s.signerType === "venue");
  const clientSigners = signers.filter((s) => s.signerType === "client");
  const requiredClients = clientSigners.filter((s) => s.isRequired);
  const requiredClientSigned = requiredClients.filter((s) => s.signedAt).length;
  const venueSigned = Boolean(venueSigner?.signedAt);
  const uiState = deriveContractSigningUiState({
    status: contract.status,
    venueSigned,
    requiredClientTotal: requiredClients.length || 1,
    requiredClientSigned,
    expiresAt: contract.expiresAt,
  });

  const primaryClientSigner = requiredClients[0];

  const shareRecipient = {
    name: primaryClientSigner?.signerName ?? contract.clientName ?? "the client",
    contact: primaryClientSigner?.signerEmail ?? contract.clientEmail,
    relationshipLabel: "Client",
  };
  const shareMergeData = buildMergeData({ venueName, clientName: contract.clientName ?? "", coordinatorName: venueName, eventDate: contract.eventDate });
  const shareDefaultMessage = mergeContent(
    `{{venue_name}} has sent you "${contract.title}" to review and sign.`,
    shareMergeData,
  );

  const canEditContent = contract.status === "draft" && !venueSigned;

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
    if (!confirm(
      "Cancel and void this contract?\n\n"
      + "This stops the client signing link (withdraw). It cannot be undone.\n\n"
      + "Emails already delivered are not recalled.",
    )) return;
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

  function handleVenueSign() {
    if (!venueSignerName.trim()) { toast.error("Please enter your full name."); return; }
    if (!venueConsent) { toast.error("Please confirm you agree this constitutes your legal signature."); return; }
    startVenueSign(async () => {
      const result = await venueSignContractAction(contract.id, venueSignerName, venueConsent);
      if (result.ok) {
        toast.success("Signed by venue. Ready to release to the client.");
        setShowVenueSign(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not record venue signature.");
      }
    });
  }

  function handleWithdrawVenueSign() {
    if (!confirm("Withdraw the venue signature so this agreement can be edited?")) return;
    startWithdraw(async () => {
      const result = await withdrawVenueSignatureAction(contract.id);
      if (result.ok) { toast.success("Venue signature withdrawn."); router.refresh(); }
      else toast.error(result.message ?? "Could not withdraw signature.");
    });
  }

  const expiry = contract.expiresAt ? (() => {
    const days = Math.floor((new Date(contract.expiresAt + "T12:00:00").getTime() - Date.now()) / 86_400_000);
    const expired = days < 0;
    return { expired, text: expired ? `Expired ${Math.abs(days)}d ago` : `Expires ${formatContractDate(contract.expiresAt!)}`, soon: !expired && days <= 14 };
  })() : null;

  return (
    <div className="space-y-6">
      {contract.executionOrigin === "external" ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          This agreement was executed outside Hello to Cheers. It is recorded as signed for operations, but Hello to Cheers did not collect e-signatures for it. Use the attached Event document as the original signed file.
        </div>
      ) : null}
      <BusinessAssetHeader
        backHref="/contracts"
        backLabel="Contracts"
        whatIsThis="Contract"
        title={contract.title}
        status={
          <div className="flex items-center gap-1.5 flex-wrap">
            <ContractStatusBadge status={contract.status} executionOrigin={contract.executionOrigin} />
            <Badge variant="outline">{uiState.label}</Badge>
            {finalized && (
              <Badge variant="success"><Lock className="mr-1 h-3 w-3" />Finalized</Badge>
            )}
          </div>
        }
        waitingOn={CONTRACT_WAITING_ON[contract.status]}
        lastUpdated={formatContractDate(contract.updatedAt.slice(0, 10))}
        relationship={contract.clientName ? { name: contract.clientName, href: `/clients/${contract.clientId}` } : null}
        primaryAction={
          contract.status === "draft" && !venueSigned ? (
            <Button size="sm" onClick={() => setShowVenueSign(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />Sign contract
            </Button>
          ) : contract.status === "draft" && venueSigned ? (
            <ShareDialog
              trigger={<Button size="sm"><Send className="mr-1 h-3.5 w-3.5" />Release to client</Button>}
              title="Release Contract"
              recipient={shareRecipient}
              whatHappensNext="Each required client signer receives their own signing link. The agreement is already signed by the venue."
              defaultMessage={shareDefaultMessage}
              sendLabel="Release to client"
              onSend={async (message) => sendContractAction(contract.id, message)}
              onSent={() => router.refresh()}
            />
          ) : contract.status === "sent" ? (
            <ShareDialog
              trigger={<Button size="sm" variant="outline"><RotateCcw className="mr-1 h-3.5 w-3.5" />Resend</Button>}
              title="Resend Contract"
              recipient={shareRecipient}
              whatHappensNext="They'll get another copy of their signing link — nothing about the contract changes."
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
          {canEditContent && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {contract.status === "draft" && venueSigned && (
            <Button variant="outline" size="sm" onClick={handleWithdrawVenueSign} disabled={withdrawPending}>
              {withdrawPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Withdrawing…</> : "Withdraw signature"}
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

      {/* Venue sign form — same content the client will see */}
      {showVenueSign && contract.status === "draft" && !venueSigned && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Sign as venue</CardTitle>
            <CardDescription>
              Review the agreement below, then sign. Release to the client is only available after this step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-4 max-h-64 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-sans">{contract.content}</pre>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="venue-signer-name">Full legal name *</Label>
              <Input
                id="venue-signer-name"
                value={venueSignerName}
                onChange={(e) => setVenueSignerName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="venue-consent"
                checked={venueConsent}
                onCheckedChange={(c) => setVenueConsent(c === true)}
                className="mt-0.5"
              />
              <Label htmlFor="venue-consent" className="text-xs font-normal leading-snug">
                {CONTRACT_SIGNATURE_CONSENT_TEXT}
              </Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleVenueSign} disabled={venueSignPending}>
                {venueSignPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Signing…</> : "Sign contract"}
              </Button>
              <Button variant="outline" onClick={() => setShowVenueSign(false)} disabled={venueSignPending}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signers status */}
      {signers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Signatures</CardTitle>
            <CardDescription>{uiState.label}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {venueSigner && (
              <div className="flex justify-between gap-4">
                <span>Venue{venueSigner.signerName ? ` — ${venueSigner.signerName}` : ""}</span>
                <span className="text-muted-foreground">
                  {venueSigner.signedAt
                    ? `Signed ${formatContractDate(venueSigner.signedAt.slice(0, 10))}`
                    : "Awaiting venue signature"}
                </span>
              </div>
            )}
            {clientSigners.map((s) => (
              <div key={s.id} className="flex justify-between gap-4">
                <span>{s.signerName ?? "Client"}{s.signerEmail ? ` (${s.signerEmail})` : ""}</span>
                <span className="text-muted-foreground">
                  {s.signedAt
                    ? `Signed ${formatContractDate(s.signedAt.slice(0, 10))}`
                    : contract.status === "sent" ? "Awaiting signature" : "Not yet released"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
          <CardContent className="py-4 space-y-3">
            <p className="text-sm font-medium text-heading">Client signing links:</p>
            {(requiredClients.length > 0 ? requiredClients : [{ id: "legacy", signToken: contract.signToken, signerName: contract.clientName, signerEmail: contract.clientEmail } as const]).map((s) => {
              const url = typeof window !== "undefined"
                ? `${window.location.origin}/sign/${s.signToken}`
                : `/sign/${s.signToken}`;
              return (
                <div key={s.id} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{s.signerName ?? "Client"}{s.signerEmail ? ` · ${s.signerEmail}` : ""}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground">
                      {url}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard?.writeText(url).then(() => toast.success("Signing link copied."));
                    }}>
                      <Copy className="mr-1 h-3.5 w-3.5" />Copy
                    </Button>
                  </div>
                </div>
              );
            })}
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
                Fully signed{contract.signerName ? ` — last signature by ${contract.signerName}` : ""}
                {contract.signedAt ? ` on ${formatContractDate(contract.signedAt.slice(0, 10))}` : ""}
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
