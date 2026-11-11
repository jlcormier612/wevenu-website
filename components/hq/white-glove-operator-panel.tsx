"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  finishWhiteGloveSetupAction,
  startOperatorConfigureAction,
} from "@/app/admin/onboarding/actions";
import {
  suggestImportEntityFromFileName,
  suggestPlanningImport,
} from "@/lib/onboarding/materials";
import { WhiteGloveMaterialReview } from "@/components/hq/white-glove-material-review";

export type OperatorStageStatus =
  | "we_can_finish"
  | "decision_needed"
  | "can_complete_later"
  | "in_progress"
  | "complete";

export type OperatorStageRow = {
  key: string;
  title: string;
  status: OperatorStageStatus;
  detail?: string | null;
};

export type OperatorMaterialRow = {
  id: string;
  fileName: string;
  contentType?: string | null;
  byteSize?: number | null;
  uploadedAt?: string;
  downloadPath: string;
  hasStorageObject: boolean;
};

const STATUS_LABEL: Record<OperatorStageStatus, string> = {
  we_can_finish: "We can finish this",
  decision_needed: "Your decision needed",
  can_complete_later: "Can be completed later",
  in_progress: "In progress",
  complete: "Complete",
};

function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function WhiteGloveOperatorPanel({
  venueId,
  venueName,
  whiteGloveStatus,
  accessEmailSentAt,
  stages,
  materials,
  intakeSummary,
  validationIssues,
}: {
  venueId: string;
  venueName: string;
  whiteGloveStatus: string | null;
  accessEmailSentAt: string | null;
  stages: OperatorStageRow[];
  materials: OperatorMaterialRow[];
  intakeSummary: string | null;
  validationIssues: Array<{ code: string; message: string }>;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reviewMaterialId, setReviewMaterialId] = React.useState<string | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  // Access email recorded = customer handoff complete. Token + pending status
  // without access_email_sent_at means email failed and Finish must be retried.
  const handedOff =
    Boolean(accessEmailSentAt) || whiteGloveStatus === "complete";
  const pendingAccessEmail =
    whiteGloveStatus === "setup_complete_access_pending" && !accessEmailSentAt;

  async function finish() {
    setBusy(true);
    setError(null);
    const result = await finishWhiteGloveSetupAction(venueId);
    setBusy(false);
    if (!result.ok) {
      const msg =
        result.issues?.map((i) => i.message).join(" ") ||
        result.error ||
        "Handoff failed";
      setError(msg);
      return;
    }
    setConfirmOpen(false);
    router.refresh();
  }

  async function openMaterial(m: OperatorMaterialRow) {
    setDownloadError(null);
    if (!m.hasStorageObject) {
      setDownloadError(`${m.fileName} is missing its storage object.`);
      return;
    }
    try {
      const res = await fetch(`${m.downloadPath}?format=json`, { credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; signedUrl?: string; error?: string };
      if (!res.ok || !data.signedUrl) {
        setDownloadError(data.error || `Could not open ${m.fileName}.`);
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      setDownloadError(`Could not open ${m.fileName}.`);
    }
  }

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="font-heading text-sm font-semibold text-heading">
          White Glove — {venueName}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Product HQ is the source of truth for setup progress and customer access.
          CRM checklist tasks track engagement only — they do not grant access.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Status: {whiteGloveStatus ?? "unknown"} · Work on the real venue Setup Hub and
          migration tools below.
        </p>
        {pendingAccessEmail ? (
          <p className="mt-2 text-xs text-amber-800">
            Access email has not been delivered yet. Retry Finish White Glove Setup — the
            same activation token will be reused.
          </p>
        ) : null}
      </div>

      {intakeSummary ? (
        <div className="rounded-md border bg-muted/20 p-3 text-sm whitespace-pre-wrap">
          {intakeSummary}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Intake not submitted yet.</p>
      )}

      {materials.length > 0 ? (
        <div>
          <p className="text-xs font-medium mb-2">Materials received</p>
          <p className="mb-2 text-xs text-muted-foreground">
            File received ≠ configuration complete. Use Import below to stage packages or
            planning content for review before committing product records.
          </p>
          {downloadError ? (
            <p className="mb-2 text-xs text-destructive">{downloadError}</p>
          ) : null}
          <ul className="space-y-2 text-sm">
            {materials.map((m) => {
              const pkgHint = suggestImportEntityFromFileName(m.fileName);
              const planningHint = suggestPlanningImport(m.fileName);
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                  data-testid={`wg-material-${m.id}`}
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="text-left font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => openMaterial(m)}
                      data-testid={`wg-material-open-${m.id}`}
                    >
                      {m.fileName}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      Received
                      {m.uploadedAt ? ` · ${new Date(m.uploadedAt).toLocaleString()}` : ""}
                      {m.byteSize != null ? ` · ${formatBytes(m.byteSize)}` : ""}
                      {!m.hasStorageObject ? " · file unavailable" : ""}
                    </p>
                    {pkgHint || planningHint ? (
                      <p className="text-xs text-muted-foreground">
                        Suggested next step:{" "}
                        {pkgHint === "packages"
                          ? "Package Templates import (review before commit)"
                          : pkgHint === "inventory"
                            ? "Inventory Templates import (review before commit)"
                            : "Planning / playbook import (review before apply)"}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openMaterial(m)}
                    >
                      Open / download
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid={`wg-material-review-${m.id}`}
                      onClick={() => setReviewMaterialId(m.id)}
                    >
                      Review import
                    </Button>
                    {pkgHint ? (
                      <Link
                        href={`#wg-import-wizard`}
                        className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs"
                        onClick={() => {
                          try {
                            sessionStorage.setItem(
                              `wg-seed-material:${venueId}`,
                              JSON.stringify({
                                materialId: m.id,
                                fileName: m.fileName,
                                entity: pkgHint,
                              }),
                            );
                          } catch {
                            /* ignore */
                          }
                        }}
                      >
                        Use in Import Wizard
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {reviewMaterialId ? (
            <WhiteGloveMaterialReview
              venueId={venueId}
              materialId={reviewMaterialId}
              fileName={materials.find((row) => row.id === reviewMaterialId)?.fileName ?? "Material"}
              onClose={() => setReviewMaterialId(null)}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No materials uploaded.</p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium">Setup Hub status</p>
        {stages.map((s) => (
          <div
            key={s.key}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <span className="font-medium">{s.title}</span>
            <span className="text-xs text-muted-foreground">{STATUS_LABEL[s.status]}</span>
            {s.detail ? (
              <p className="w-full text-xs text-muted-foreground">{s.detail}</p>
            ) : null}
          </div>
        ))}
      </div>

      {validationIssues.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-medium">Resolve before handoff</p>
          <ul className="mt-1 list-disc pl-5">
            {validationIssues.map((i) => (
              <li key={i.code}>{i.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!handedOff ? (
        <div className="flex flex-wrap gap-2">
          <form action={startOperatorConfigureAction.bind(null, venueId)}>
            <Button type="submit" variant="outline">
              Configure in Setup Hub
            </Button>
          </form>
          {!confirmOpen ? (
            <Button type="button" onClick={() => setConfirmOpen(true)}>
              Finish White Glove Setup
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm font-medium text-emerald-700">
          White Glove Setup Complete / Customer Access Pending
        </p>
      )}

      {!handedOff && confirmOpen ? (
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="font-medium">Ready to hand off?</h3>
            <p className="text-sm text-muted-foreground">
              You&apos;ve completed the setup work for this venue.
            </p>
            <p className="text-sm text-muted-foreground">
              Any items you&apos;ve left for the venue owner will be available when they sign
              in.
            </p>
            <p className="text-sm text-muted-foreground">
              Once you finish, we&apos;ll send the owner their access information. CRM
              checklist completion alone does not send access.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={finish}>
                {busy ? "Finishing…" : "Finish White Glove Setup"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
      ) : null}
    </div>
  );
}
