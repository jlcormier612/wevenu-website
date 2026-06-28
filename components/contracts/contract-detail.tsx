"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelContractAction,
  deleteContractAction,
  sendContractAction,
  updateContractContentAction,
} from "@/app/(app)/contracts/actions";
import { ContractStatusBadge } from "@/components/contracts/contract-status-badge";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatContractDate } from "@/lib/contracts/constants";
import type { ContractWithDetails } from "@/lib/contracts/types";

export function ContractDetail({ contract }: { contract: ContractWithDetails }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(contract.title);
  const [editContent, setEditContent] = React.useState(contract.content);
  const [sendPending, startSend] = React.useTransition();
  const [savePending, startSave] = React.useTransition();
  const [cancelPending, startCancel] = React.useTransition();
  const [deletePending, startDelete] = React.useTransition();
  const [copied, setCopied] = React.useState(false);

  const signUrl = typeof window !== "undefined"
    ? `${window.location.origin}/sign/${contract.signToken}`
    : `/sign/${contract.signToken}`;

  function handleSend() {
    startSend(async () => {
      const result = await sendContractAction(contract.id);
      if (result.ok) { toast.success("Contract sent. Share the signing link with your client."); router.refresh(); }
      else toast.error(result.message ?? "Could not send contract.");
    });
  }

  function handleSaveEdit() {
    startSave(async () => {
      const result = await updateContractContentAction(contract.id, editTitle, editContent);
      if (result.ok) { toast.success("Contract updated."); setEditing(false); router.refresh(); }
      else toast.error(result.message ?? "Could not save.");
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

  function copyLink() {
    navigator.clipboard?.writeText(signUrl).then(() => {
      setCopied(true);
      toast.success("Signing link copied.");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground"
            render={<Link href="/contracts" />}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Contracts
          </Button>
          <h1 className="font-heading text-2xl font-medium text-heading">{contract.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {contract.clientName && (
              <Link href={`/clients/${contract.clientId}`} className="hover:text-primary">{contract.clientName}</Link>
            )}
            {contract.signedAt && <><span className="text-border">·</span><span className="text-success">Signed {formatContractDate(contract.signedAt.slice(0, 10))}</span></>}
            {contract.sentAt && !contract.signedAt && <><span className="text-border">·</span><span>Sent {formatContractDate(contract.sentAt.slice(0, 10))}</span></>}
            {contract.expiresAt && (() => {
              const days = Math.floor((new Date(contract.expiresAt + "T12:00:00").getTime() - Date.now()) / 86_400_000);
              const expired = days < 0;
              return <><span className="text-border">·</span><span className={expired ? "text-destructive font-medium" : days <= 14 ? "text-warning-foreground font-medium" : ""}>{expired ? `Expired ${Math.abs(days)}d ago` : `Expires ${formatContractDate(contract.expiresAt)}`}</span></>;
            })()}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ContractStatusBadge status={contract.status} />
          {contract.status === "draft" && (
            <>
              <Button size="sm" onClick={handleSend} disabled={sendPending}>
                {sendPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Sending…</> : <><Send className="mr-1 h-3.5 w-3.5" />Send for Signing</>}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
            </>
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
        </div>
      </div>

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
              <p className="text-xs text-muted-foreground">This agreement is complete.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract document */}
      {editing ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Edit Contract</CardTitle>
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
              {contract.status === "signed" ? "Final signed agreement." : "Review before sending for signature."}
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
