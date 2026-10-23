"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { sendContractAction } from "@/app/(app)/contracts/actions";
import { StarterPolicyPlaceholderDialog } from "@/components/contracts/starter-policy-placeholder-dialog";
import { ContractStatusBadge } from "@/components/contracts/contract-status-badge";
import { DocumentWorkspace } from "@/components/document-workspace/document-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Contract, ContractTemplate } from "@/lib/contracts/types";
import type { Document, DocumentEntityType } from "@/lib/documents/types";
import type { WorkspaceDocument } from "@/lib/document-workspace/types";
import type { Questionnaire } from "@/lib/events/questionnaire";
import {
  isReturnedQuestionnaireDocumentStatus,
} from "@/lib/document-workspace/questionnaire-document-status";
import { questionnaireStatusLabel } from "@/lib/events/questionnaire-constants";

function formatSentDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Event-specific contracts only — not reusable templates.
 * Send/resend stays on the contract record when it already exists for this booking.
 */
function EventContractsSection({
  contracts,
  returnTo,
}: {
  contracts: Contract[];
  returnTo?: string;
}) {
  const router = useRouter();
  const [sendingContract, startSendContract] = React.useTransition();
  const [placeholderWarningId, setPlaceholderWarningId] = React.useState<string | null>(null);

  function handleSendContract(id: string, acknowledgePlaceholders = false) {
    startSendContract(async () => {
      const result = await sendContractAction(
        id,
        undefined,
        acknowledgePlaceholders ? { acknowledgePlaceholders: true } : undefined,
      );
      if (result.ok) {
        toast.success("Contract sent.");
        setPlaceholderWarningId(null);
        router.refresh();
        return;
      }
      if (result.code === "STARTER_POLICY_PLACEHOLDERS") {
        setPlaceholderWarningId(id);
        return;
      }
      toast.error(result.message ?? "Could not send.");
    });
  }

  const contractHref = (id: string) =>
    returnTo
      ? `/contracts/${id}?returnTo=${encodeURIComponent(returnTo)}`
      : `/contracts/${id}`;

  if (contracts.length === 0) return null;

  return (
    <>
      <Card data-testid="booking-documents-contracts">
        <CardHeader>
          <CardTitle className="text-base">Contracts</CardTitle>
          <CardDescription>
            Agreements created for this booking — not reusable templates from the Library.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {contracts.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  {c.executionOrigin === "external"
                    ? `Signed outside HTC${c.signedAt ? ` · ${formatSentDate(c.signedAt)}` : ""}`
                    : `Sent ${formatSentDate(c.sentAt)}${c.signedAt ? ` · Signed ${formatSentDate(c.signedAt)}` : ""}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ContractStatusBadge status={c.status} executionOrigin={c.executionOrigin} />
                {c.status === "draft" ? (
                  <Button size="sm" variant="outline" disabled={sendingContract} onClick={() => handleSendContract(c.id)}>
                    {sendingContract ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send"}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" render={<Link href={contractHref(c.id)} />}>View</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <StarterPolicyPlaceholderDialog
        open={placeholderWarningId !== null}
        pending={sendingContract}
        onGoBack={() => setPlaceholderWarningId(null)}
        onSendAnyway={() => {
          if (placeholderWarningId) handleSendContract(placeholderWarningId, true);
        }}
      />
    </>
  );
}

/**
 * Returned questionnaires only — blank templates and send actions live on the
 * Questionnaires tab / Library, not here.
 */
function ReturnedQuestionnairesSection({
  questionnaire,
  reviewHref,
}: {
  questionnaire: Questionnaire | null;
  reviewHref: string;
}) {
  if (!questionnaire || !isReturnedQuestionnaireDocumentStatus(questionnaire.status)) {
    return null;
  }

  return (
    <Card data-testid="booking-documents-returned-questionnaire">
      <CardHeader>
        <CardTitle className="text-base">Returned questionnaires</CardTitle>
        <CardDescription>
          Completed responses for this booking. Send and review stay on the Questionnaires workflow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Questionnaire</p>
            <p className="text-xs text-muted-foreground">
              {questionnaire.submittedAt
                ? `Submitted ${formatSentDate(questionnaire.submittedAt)}`
                : questionnaireStatusLabel(questionnaire.status)}
              {" · "}
              {questionnaireStatusLabel(questionnaire.status)}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            render={<Link href={reviewHref} />}
            data-testid="booking-documents-view-questionnaire"
          >
            View answers
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function BookingDocumentsTab({
  entityType, entityId, venueId,
  workspaceDocuments = [], pinnedDocumentKeys = [],
  contractTemplates: _contractTemplates, contracts, questionnaire,
  eventId, eventName: _eventName, coupleEmail: _coupleEmail, coupleName: _coupleName,
  returnTo,
}: {
  entityType: DocumentEntityType;
  entityId: string;
  venueId: string;
  documents: Document[];
  vendorDocuments?: (Document & { vendorName: string | null })[];
  workspaceDocuments?: WorkspaceDocument[];
  pinnedDocumentKeys?: string[];
  /** @deprecated Templates are not event documents — kept for call-site compatibility. */
  contractTemplates: ContractTemplate[];
  contracts: Contract[];
  questionnaire: Questionnaire | null;
  eventId: string;
  eventName: string;
  coupleEmail: string | null;
  coupleName: string | null;
  /** Client Workspace path for Contract Detail back navigation. */
  returnTo?: string;
}) {
  void _contractTemplates;
  void _eventName;
  void _coupleEmail;
  void _coupleName;

  const artifactDocuments = workspaceDocuments.filter(
    (d) =>
      d.docType !== "questionnaire"
      || isReturnedQuestionnaireDocumentStatus(d.rawStatus),
  );

  return (
    <div className="space-y-4" data-testid="booking-documents-tab">
      <EventContractsSection contracts={contracts} returnTo={returnTo} />
      <ReturnedQuestionnairesSection
        questionnaire={questionnaire}
        reviewHref={`${returnTo ?? `/events/${eventId}`}#questionnaires`}
      />
      <DocumentWorkspace
        title="Documents"
        description="Files and completed records for this booking — uploaded by your venue, the client, or shared by vendors. Reusable templates and send actions live in Library and the Questionnaires / Contracts workflows. A questionnaire appears here only after the couple returns it."
        documents={artifactDocuments}
        initialPinnedKeys={pinnedDocumentKeys}
        uploadTarget={{ entityType, entityId, venueId }}
        returnTo={returnTo}
      />
    </div>
  );
}
