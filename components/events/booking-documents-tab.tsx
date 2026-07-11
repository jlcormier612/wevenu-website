"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { sendContractAction } from "@/app/(app)/contracts/actions";
import { sendQuestionnaireAction } from "@/app/(app)/events/[id]/questionnaire-actions";
import { ContractStatusBadge } from "@/components/contracts/contract-status-badge";
import { DocumentsSection } from "@/components/documents/documents-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Contract, ContractTemplate } from "@/lib/contracts/types";
import type { Document, DocumentEntityType } from "@/lib/documents/types";
import type { Questionnaire } from "@/lib/events/questionnaire";

function formatSentDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---- Templates — reusable, sendable starting points, not yet tied to this booking ----

function TemplatesSection({
  contractTemplates, questionnaire, eventId, coupleEmail, coupleName, eventName,
}: {
  contractTemplates: ContractTemplate[];
  questionnaire: Questionnaire | null;
  eventId: string;
  coupleEmail: string | null;
  coupleName: string | null;
  eventName: string;
}) {
  const router = useRouter();
  const [sendingQuestionnaire, startSendQuestionnaire] = React.useTransition();

  function handleSendQuestionnaire() {
    if (!coupleEmail) { toast.error("This client has no email address on file."); return; }
    startSendQuestionnaire(async () => {
      const result = await sendQuestionnaireAction(eventId, coupleEmail, coupleName ?? "", eventName);
      if (result.ok) { toast.success("Final details form sent."); router.refresh(); }
      else toast.error(result.message ?? "Could not send.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Templates</CardTitle>
        <CardDescription>Reusable templates your venue can send for this booking.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Contract</p>
            <p className="text-xs text-muted-foreground">
              {contractTemplates.length > 0
                ? `${contractTemplates.length} template${contractTemplates.length === 1 ? "" : "s"} available: ${contractTemplates.map((t) => t.name).join(", ")}`
                : "No contract templates yet."}
            </p>
          </div>
          <Button size="sm" variant="outline" render={<Link href="/contracts/new" />}>Send a Contract</Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Questionnaire</p>
            <p className="text-xs text-muted-foreground">Final details — guest count, timing, music, special requests.</p>
          </div>
          {questionnaire?.status === "sent" || questionnaire?.status === "submitted" || questionnaire?.status === "reviewed" ? (
            <Badge variant="muted" className="text-[10px]">Already sent</Badge>
          ) : (
            <Button size="sm" variant="outline" disabled={sendingQuestionnaire} onClick={handleSendQuestionnaire}>
              {sendingQuestionnaire ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send Questionnaire"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Sent / Requested — documents with a real lifecycle (status, sent, completed) ----

function SentRequestedSection({ contracts, questionnaire }: { contracts: Contract[]; questionnaire: Questionnaire | null }) {
  const router = useRouter();
  const [sendingContract, startSendContract] = React.useTransition();

  function handleSendContract(id: string) {
    startSendContract(async () => {
      const result = await sendContractAction(id);
      if (result.ok) { toast.success("Contract sent."); router.refresh(); }
      else toast.error(result.message ?? "Could not send.");
    });
  }

  const hasAnything = contracts.length > 0 || (questionnaire && questionnaire.status !== "draft");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sent / Requested</CardTitle>
        <CardDescription>Documents already sent to this booking, and where things stand.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!hasAnything && <p className="py-4 text-center text-sm text-muted-foreground">Nothing sent yet.</p>}

        {contracts.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{c.title}</p>
              <p className="text-xs text-muted-foreground">
                Sent {formatSentDate(c.sentAt)}
                {c.signedAt && ` · Signed ${formatSentDate(c.signedAt)}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ContractStatusBadge status={c.status} />
              {c.status === "draft" ? (
                <Button size="sm" variant="outline" disabled={sendingContract} onClick={() => handleSendContract(c.id)}>
                  {sendingContract ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send"}
                </Button>
              ) : (
                <Button size="sm" variant="ghost" render={<Link href={`/contracts/${c.id}`} />}>View</Button>
              )}
            </div>
          </div>
        ))}

        {questionnaire && questionnaire.status !== "draft" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Questionnaire</p>
              <p className="text-xs text-muted-foreground">
                Sent {formatSentDate(questionnaire.sentAt)}
                {questionnaire.submittedAt && ` · Completed ${formatSentDate(questionnaire.submittedAt)}`}
              </p>
            </div>
            <Badge variant={questionnaire.status === "submitted" || questionnaire.status === "reviewed" ? "success" : "default"} className="text-[10px]">
              {questionnaire.status === "sent" ? "Sent" : "Completed"}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Main -----------------------------------------------------------------------

export function BookingDocumentsTab({
  entityType, entityId, venueId, documents,
  contractTemplates, contracts, questionnaire,
  eventId, eventName, coupleEmail, coupleName,
}: {
  entityType: DocumentEntityType;
  entityId: string;
  venueId: string;
  documents: Document[];
  contractTemplates: ContractTemplate[];
  contracts: Contract[];
  questionnaire: Questionnaire | null;
  eventId: string;
  eventName: string;
  coupleEmail: string | null;
  coupleName: string | null;
}) {
  return (
    <div className="space-y-4">
      <TemplatesSection
        contractTemplates={contractTemplates} questionnaire={questionnaire}
        eventId={eventId} coupleEmail={coupleEmail} coupleName={coupleName} eventName={eventName}
      />
      <SentRequestedSection contracts={contracts} questionnaire={questionnaire} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uploaded</CardTitle>
          <CardDescription>Files uploaded by your venue or the client. Anything a Planning task links to already appears here — it&apos;s the same file, not a copy.</CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentsSection entityType={entityType} entityId={entityId} venueId={venueId} initialDocuments={documents} />
        </CardContent>
      </Card>
    </div>
  );
}
