"use client";

import * as React from "react";

import Link from "next/link";
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
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelContractAction,
  createNewVersionFromContractAction,
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
import { SignForm } from "@/app/sign/[token]/sign-form";
import { ArtifactReviewOverlay } from "@/components/artifacts/artifact-review-overlay";
import { ContractBuilder } from "@/components/contracts/contract-builder";
import { ContractStatusBadge } from "@/components/contracts/contract-status-badge";
import { ContractSigningArtifact } from "@/components/contracts/contract-signing-artifact";
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
import { resolveContractBrandPresentation, type ContractBrandingSnapshot } from "@/lib/contracts/branding";
import { renderExecutedContractContent } from "@/lib/contracts/executed-content";
import {
  anyClientHasSigned,
  CONTRACT_SIGNATURE_CONSENT_TEXT,
  deriveContractSigningUiState,
} from "@/lib/contracts/signers";
import type { ContractStatus, ContractWithDetails } from "@/lib/contracts/types";
import {
  formatVersionLabel,
  statusLabelForVersion,
  type ContractVersionEntry,
} from "@/lib/contracts/version-lineage";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";

const CONTRACT_WAITING_ON: Record<ContractStatus, WaitingOn> = {
  draft: "venue", sent: "client", signed: "completed", cancelled: "none", expired: "none",
};

export function ContractDetail({
  contract,
  finalized,
  venueName,
  venueBrand = null,
  versionFamily = [],
  initialReview = false,
}: {
  contract: ContractWithDetails;
  finalized: boolean;
  venueName: string;
  venueBrand?: ContractBrandingSnapshot | null;
  versionFamily?: ContractVersionEntry[];
  initialReview?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(initialReview && contract.status !== "draft");
  const [releaseMessage, setReleaseMessage] = React.useState("");
  const [sendPending, startSend] = React.useTransition();
  const [editTitle, setEditTitle] = React.useState(contract.title);
  const [editContent, setEditContent] = React.useState(contract.content);
  const [savePending, startSave] = React.useTransition();
  const [cancelPending, startCancel] = React.useTransition();
  const [deletePending, startDelete] = React.useTransition();
  const [reopenPending, startReopen] = React.useTransition();
  const [finalizePending, startFinalize] = React.useTransition();
  const [pdfPending, startPdf] = React.useTransition();
  const [venueSignPending, startVenueSign] = React.useTransition();
  const [withdrawPending, startWithdraw] = React.useTransition();
  const [newVersionPending, startNewVersion] = React.useTransition();
  const [venueSignerName, setVenueSignerName] = React.useState("");
  const [venueConsent, setVenueConsent] = React.useState(false);
  const [showVenueSign, setShowVenueSign] = React.useState(false);

  const signers = contract.signers ?? [];
  const venueSigner = signers.find((s) => s.signerType === "venue");
  const clientSigners = signers.filter((s) => s.signerType === "client");
  const requiredClients = clientSigners.filter((s) => s.isRequired);
  const requiredClientSigned = requiredClients.filter((s) => s.signedAt).length;
  const venueSigned = Boolean(venueSigner?.signedAt);
  const clientSigned = anyClientHasSigned(signers);
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

  const canEditContent =
    (contract.status === "draft" || contract.status === "sent") && !clientSigned;
  /**
   * Reopen-for-editing is retired after a client signature (content immutable).
   * Kept false so the action cannot circumvent DB immutability.
   */
  const canReopen = false;
  /** Create New Version once a client signature locks content (or fully executed). */
  const canCreateNewVersion = venueSigned || clientSigned || contract.status === "signed";
  const awaitingVenueSignature =
    contract.status === "sent" && !venueSigned && requiredClients.length > 0
      ? requiredClientSigned >= requiredClients.length
      : contract.status === "sent" && !venueSigned && clientSigned;

  const currentVersion = versionFamily.find((v) => v.current) ?? null;
  const basedOn = currentVersion?.amendsContractId
    ? versionFamily.find((v) => v.id === currentVersion.amendsContractId) ?? null
    : null;
  const versionNumber = currentVersion?.versionNumber ?? 1;

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
    if (!confirm(
      "Reopen this contract for editing?\n\n"
      + "After any signature, content cannot be reopened in place. Use Create New Version instead.",
    )) return;
    startReopen(async () => {
      const result = await reopenContractForEditingAction(contract.id);
      if (result.ok) { toast.success("Contract reopened for editing."); router.refresh(); }
      else toast.error(result.message ?? "Could not reopen contract.");
    });
  }

  function handleCreateNewVersion() {
    if (!confirm(
      "Create New Version starts a new draft based on this contract.\n\n"
      + "The original stays locked as the historical record (including any signatures and final PDF).\n"
      + "Signatures are not copied — the new draft goes through the normal signing cycle.",
    )) return;
    startNewVersion(async () => {
      const result = await createNewVersionFromContractAction(contract.id);
      if (result.ok) {
        toast.success("New version created as a draft. The original contract is unchanged.");
        router.push(`/contracts/${result.contractId}`);
      } else {
        toast.error(result.message ?? "Could not create a new version.");
      }
    });
  }

  function handleFinalize() {
    // Explicit, separate step from signing itself — locks signed content and
    // produces the official final PDF (Document Domain). Distinct from Fully signed.
    if (!confirm(
      "Finalize this contract?\n\n"
      + "This generates the official final PDF for the fully signed agreement.\n"
      + "It does not collect payment or mark them commercially Booked.\n"
      + "This cannot be undone.",
    )) return;
    startFinalize(async () => {
      const result = await finalizeContractAction(contract.id);
      if (result.ok) { toast.success("Final PDF generated."); router.refresh(); }
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

  function handleVenueSign() {
    if (!venueSignerName.trim()) { toast.error("Please enter your full name."); return; }
    if (!venueConsent) { toast.error("Please confirm you agree this constitutes your legal signature."); return; }
    startVenueSign(async () => {
      const result = await venueSignContractAction(contract.id, venueSignerName, venueConsent);
      if (result.ok) {
        if (result.newlyBooked && result.clientId) {
          const qs = new URLSearchParams();
          if (result.eventId) qs.set("eventId", result.eventId);
          window.location.href = `/clients/${result.clientId}/booked?${qs.toString()}`;
          return;
        }
        toast.success("Signed by venue. Contract is fully executed.");
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

  function handleSendToClient() {
    startSend(async () => {
      const result = await sendContractAction(contract.id, releaseMessage);
      if (result.ok) {
        toast.success("Contract sent to the client for review.");
        setReviewOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not send to the client.");
      }
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
            <Badge variant="muted">{formatVersionLabel(versionNumber)}</Badge>
            <ContractStatusBadge
              status={contract.status}
              executionOrigin={contract.executionOrigin}
              venueSigned={venueSigned}
              requiredClientTotal={requiredClients.length || 1}
              requiredClientSigned={requiredClientSigned}
              expiresAt={contract.expiresAt}
            />
            {(clientSigned || contract.status === "signed" || finalized) && (
              <Badge variant="muted"><Lock className="mr-1 h-3 w-3" />Locked</Badge>
            )}
            {finalized && (
              <Badge variant="success"><Lock className="mr-1 h-3 w-3" />Final PDF ready</Badge>
            )}
          </div>
        }
        waitingOn={awaitingVenueSignature ? "venue" : CONTRACT_WAITING_ON[contract.status]}
        lastUpdated={formatContractDate(contract.updatedAt.slice(0, 10))}
        relationship={contract.clientName ? { name: contract.clientName, href: `/clients/${contract.clientId}` } : null}
        primaryAction={
          contract.status === "draft" ? null : awaitingVenueSignature ? (
            <Button size="sm" onClick={() => setShowVenueSign(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />Sign as venue
            </Button>
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
      {contract.status === "draft" && (
        <p className="text-xs text-muted-foreground">
          Status: Draft — prepare the agreement, then send it to the client for review. This does not collect a deposit or mark them Booked.
        </p>
      )}
      {contract.status === "sent" && !awaitingVenueSignature && (
        <p className="text-xs text-muted-foreground">
          Status: Sent to Client — the client is reviewing. You can still edit until they sign.
        </p>
      )}
      {awaitingVenueSignature && (
        <p className="text-xs text-muted-foreground">
          Status: Awaiting Venue Signature — the client has signed. Review their signed version, then countersign. To make substantive changes instead, use Create New Version.
        </p>
      )}
      {contract.status === "signed" && !finalized && (
        <p className="text-xs text-muted-foreground">
          Fully Executed means both parties have signed. Finalize Contract generates the official PDF — separate from payment or booking.
        </p>
      )}
      {expiry && (
        <p className={`text-xs ${expiry.expired ? "text-destructive font-medium" : expiry.soon ? "text-warning-foreground font-medium" : "text-muted-foreground"}`}>{expiry.text}</p>
      )}
      <BusinessAssetActionRow
        secondary={<>
          {canEditContent && contract.status !== "draft" && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {canReopen && (
            <Button variant="outline" size="sm" onClick={handleReopen} disabled={reopenPending}>
              {reopenPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Reopening…</> : <><RotateCcw className="mr-1 h-3.5 w-3.5" />Reopen for Editing</>}
            </Button>
          )}
          {canCreateNewVersion && (
            <Button variant="outline" size="sm" onClick={handleCreateNewVersion} disabled={newVersionPending}>
              {newVersionPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Creating…</> : <><FilePlus2 className="mr-1 h-3.5 w-3.5" />Create New Version</>}
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

      {/* Venue countersign — after client has signed */}
      {showVenueSign && awaitingVenueSignature && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Sign as venue</CardTitle>
            <CardDescription>
              Review the exact version the client signed, then countersign to fully execute the agreement.
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
                {venueSignPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Signing…</> : "Sign as venue"}
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
            {clientSigners.map((s) => (
              <div key={s.id} className="flex justify-between gap-4">
                <span>{s.signerName ?? "Client"}{s.signerEmail ? ` (${s.signerEmail})` : ""}</span>
                <span className="text-muted-foreground">
                  {s.signedAt
                    ? `Signed ${formatContractDate(s.signedAt.slice(0, 10))}`
                    : contract.status === "sent" ? "Awaiting signature" : "Not yet sent"}
                </span>
              </div>
            ))}
            {venueSigner && (
              <div className="flex justify-between gap-4">
                <span>Venue{venueSigner.signerName ? ` — ${venueSigner.signerName}` : ""}</span>
                <span className="text-muted-foreground">
                  {venueSigner.signedAt
                    ? `Signed ${formatContractDate(venueSigner.signedAt.slice(0, 10))}`
                    : awaitingVenueSignature
                      ? "Awaiting venue signature"
                      : contract.status === "sent"
                        ? "Signs after the client"
                        : "Signs after the client"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Version lineage — derived from amends_contract_id */}
      {(versionFamily.length > 0 || basedOn) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Version history</CardTitle>
            <CardDescription>
              {formatVersionLabel(versionNumber)}
              {currentVersion ? ` · ${statusLabelForVersion({ ...currentVersion, finalized: finalized || currentVersion.finalized })}` : null}
              {basedOn ? (
                <>
                  {" · Based on "}
                  <a href={`/contracts/${basedOn.id}`} className="underline hover:text-foreground">
                    {formatVersionLabel(basedOn.versionNumber)} · {statusLabelForVersion(basedOn)}
                  </a>
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          {versionFamily.length > 1 && (
            <CardContent className="space-y-2">
              {versionFamily.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    {v.current ? (
                      <span className="font-medium text-heading">
                        {formatVersionLabel(v.versionNumber)} · {statusLabelForVersion(v.current && finalized ? { ...v, finalized: true } : v)}
                        {" · Current"}
                      </span>
                    ) : (
                      <a href={`/contracts/${v.id}`} className="text-muted-foreground underline hover:text-foreground">
                        {formatVersionLabel(v.versionNumber)} · {statusLabelForVersion(v)}
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {v.locked && <Badge variant="muted"><Lock className="mr-1 h-3 w-3" />Locked</Badge>}
                    {v.current && <Badge variant="success">Current</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
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
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Fully Executed{contract.signerName ? ` — last signature by ${contract.signerName}` : ""}
                  {contract.signedAt ? ` on ${formatContractDate(contract.signedAt.slice(0, 10))}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Agreement fully signed. Next: collect the deposit if you haven&apos;t already. Booking isn&apos;t complete until the deposit is paid.
                  {finalized
                    ? " The final PDF is ready to download."
                    : " Finalize Contract generates the official PDF — it does not collect payment."}
                </p>
              </div>
            </div>
            {contract.clientId && (
              <Button
                size="sm"
                render={
                  <Link
                    href={
                      contract.eventId
                        ? `/clients/${contract.clientId}?setupPayments=1`
                        : `/clients/${contract.clientId}`
                    }
                  />
                }
              >
                Set up payments
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {contract.status === "draft" && (
        <ContractBuilder
          mode="draft"
          templates={[]}
          clients={[]}
          draft={{
            contractId: contract.id,
            title: contract.title,
            content: contract.content,
            clientId: contract.clientId,
            eventId: contract.eventId ?? "",
            clientName: contract.clientName,
            expectedUpdatedAt: contract.updatedAt,
          }}
          signers={signers}
          venueBrand={venueBrand}
        />
      )}

      {/* Contract document */}
      {contract.status !== "draft" && editing ? (
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
      ) : contract.status !== "draft" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract Document</CardTitle>
            <CardDescription>
              {finalized
                ? "This is a copy of the signed content. The final PDF (above) is the official record."
                : contract.status === "signed"
                  ? "Fully Executed — both parties have signed. Finalize to generate the official PDF."
                  : clientSigned && !venueSigned
                    ? "Client-signed version — content is locked. Countersign below, or Create New Version for substantive changes."
                    : "Sent to Client — they are reviewing. You can still edit until they sign."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-background p-6 font-sans text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {contract.status === "signed"
                ? renderExecutedContractContent(contract.content, signers, { status: contract.status })
                : contract.content}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Activity */}
      {contract.activities.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
          <CardContent>
            <ActivityTimeline activities={contract.activities} />
          </CardContent>
        </Card>
      )}

      <ArtifactReviewOverlay
        open={reviewOpen}
        eyebrow="Customer-facing agreement"
        title={contract.title}
        onBack={() => setReviewOpen(false)}
        primary={
          contract.status === "draft" ? (
            <Button size="sm" onClick={handleSendToClient} disabled={sendPending}>
              {sendPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send to Client"
              )}
            </Button>
          ) : undefined
        }
        footer={
          contract.status === "draft" ? (
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
          ) : null
        }
      >
        <ContractSigningArtifact
          title={contract.title}
          content={
            contract.status === "signed"
              ? renderExecutedContractContent(contract.content, signers, { status: contract.status })
              : contract.content
          }
          brand={resolveContractBrandPresentation(contract.brandingSnapshot, venueBrand)}
          signatureSlot={contract.status === "signed" ? undefined : <SignForm preview />}
        />
      </ArtifactReviewOverlay>
    </div>
  );
}
