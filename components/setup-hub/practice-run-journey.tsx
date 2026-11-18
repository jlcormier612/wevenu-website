"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  advancePracticeContractSimulationAction,
  beginPracticeStageAction,
  confirmPracticeStageExploredAction,
  markPracticeClientTriedAction,
  markPracticePlanningReviewedAction,
  practiceBookCelebrationAction,
  preparePracticeContractAction,
  preparePracticePlanningAction,
  savePracticeProposalAction,
  sharePracticePlanningAction,
  simulatePracticeClientSelectionAction,
  simulatePracticeProposalDeliveryAction,
} from "@/app/(app)/setup-hub/practice-run/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PRACTICE_STAGE_COPY,
  PRACTICE_STAGE_IDS,
  contractSimStatusLabel,
  stageStatusLabel,
  type PracticeStageId,
} from "@/lib/practice-run/journey";
import type { PracticeRun } from "@/lib/practice-run/types";

function celebrationHref(run: PracticeRun): string | null {
  if (!run.sampleClientId || !run.sampleEventId) return null;
  return `/clients/${run.sampleClientId}?eventId=${encodeURIComponent(run.sampleEventId)}`;
}

function planningHref(run: PracticeRun, hash: string): string | null {
  const base = celebrationHref(run);
  return base ? `${base}#${hash}` : null;
}

export function PracticeRunJourney({
  run,
  venuePackages,
  venueContractTemplates,
}: {
  run: PracticeRun;
  venuePackages: { id: string; name: string; basePrice: number | null }[];
  venueContractTemplates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [focusStage, setFocusStage] = React.useState<PracticeStageId>(run.journey.currentStageId);
  const journey = run.journey;
  const leadHref = run.sampleLeadId ? `/leads/${run.sampleLeadId}` : null;
  const eventHref = celebrationHref(run);

  async function runAction(
    key: string,
    fn: () => Promise<{ ok: true; message?: string } | { ok: false; message: string }>,
  ) {
    setBusy(key);
    try {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.message) toast.success(result.message);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5" data-testid="practice-run-journey">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            setFocusStage(journey.currentStageId);
            document
              .getElementById(`practice-stage-${journey.currentStageId}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          data-testid="practice-continue-where-left-off"
        >
          Continue where I left off
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<a href="#practice-all-stages" />}
          data-testid="practice-view-all-stages"
        >
          View all stages
        </Button>
      </div>

      <div id="practice-all-stages" className="space-y-4">
        {PRACTICE_STAGE_IDS.map((stageId) => {
          const copy = PRACTICE_STAGE_COPY[stageId];
          const progress = journey.stages[stageId];
          const isFocus = focusStage === stageId;
          return (
            <section
              key={stageId}
              id={`practice-stage-${stageId}`}
              className={`space-y-3 rounded-xl border px-4 py-4 sm:px-5 ${
                isFocus ? "border-primary/40 bg-card" : "border-border bg-card/80"
              }`}
              data-testid={`practice-stage-card-${stageId}`}
              data-status={progress.status}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {copy.title}
                  </p>
                  <h2 className="font-heading text-2xl font-medium tracking-tight text-heading">
                    {copy.heading}
                  </h2>
                </div>
                <Badge
                  variant={progress.status === "complete" ? "default" : "muted"}
                  data-testid={`practice-stage-status-${stageId}`}
                >
                  {stageStatusLabel(progress.status)}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{copy.explanation}</p>

              {stageId === "meet_inquiry" ? (
                <StageMeetInquiry
                  leadHref={leadHref}
                  busy={busy}
                  complete={progress.status === "complete"}
                  onOpen={async () => {
                    await runAction("meet-open", async () => beginPracticeStageAction({ stageId, runId: run.id }));
                  }}
                  onConfirm={async () => {
                    await runAction("meet-confirm", async () =>
                      confirmPracticeStageExploredAction({ stageId: "meet_inquiry", runId: run.id }),
                    );
                  }}
                />
              ) : null}

              {stageId === "prepare_proposal" ? (
                <StagePrepareProposal
                  run={run}
                  leadHref={leadHref}
                  venuePackages={venuePackages}
                  busy={busy}
                  onBegin={async () => {
                    await runAction("proposal-begin", async () =>
                      beginPracticeStageAction({ stageId, runId: run.id }),
                    );
                  }}
                  onSave={async (packageId) => {
                    await runAction("proposal-save", async () =>
                      savePracticeProposalAction({ runId: run.id, packageId }),
                    );
                  }}
                  onDeliver={async () => {
                    await runAction("proposal-deliver", async () =>
                      simulatePracticeProposalDeliveryAction({ runId: run.id }),
                    );
                  }}
                  onSimulateSelection={async () => {
                    await runAction("proposal-select", async () =>
                      simulatePracticeClientSelectionAction({ runId: run.id }),
                    );
                  }}
                />
              ) : null}

              {stageId === "create_agreement" ? (
                <StageCreateAgreement
                  run={run}
                  venueContractTemplates={venueContractTemplates}
                  busy={busy}
                  onBegin={async () => {
                    await runAction("contract-begin", async () =>
                      beginPracticeStageAction({ stageId, runId: run.id }),
                    );
                  }}
                  onPrepare={async (templateName, templateSource) => {
                    await runAction("contract-prepare", async () =>
                      preparePracticeContractAction({
                        runId: run.id,
                        templateName,
                        templateSource,
                      }),
                    );
                  }}
                  onAdvance={async () => {
                    await runAction("contract-advance", async () =>
                      advancePracticeContractSimulationAction({ runId: run.id }),
                    );
                  }}
                />
              ) : null}

              {stageId === "get_ready" ? (
                <StageGetReady
                  run={run}
                  eventHref={eventHref}
                  busy={busy}
                  onBook={async () => {
                    await runAction("practice-book", async () =>
                      practiceBookCelebrationAction({ runId: run.id }),
                    );
                  }}
                  onBegin={async () => {
                    await runAction("ready-begin", async () =>
                      beginPracticeStageAction({ stageId, runId: run.id }),
                    );
                  }}
                />
              ) : null}

              {stageId === "explore_planning" ? (
                <StageExplorePlanning
                  run={run}
                  busy={busy}
                  complete={progress.status === "complete"}
                  planningHref={planningHref}
                  onBegin={async () => {
                    await runAction("planning-begin", async () =>
                      beginPracticeStageAction({ stageId, runId: run.id }),
                    );
                  }}
                  onPrepare={async () => {
                    await runAction("planning-prepare", async () =>
                      preparePracticePlanningAction({ runId: run.id }),
                    );
                  }}
                  onShare={async () => {
                    await runAction("planning-share", async () =>
                      sharePracticePlanningAction({ runId: run.id }),
                    );
                  }}
                  onClientTried={async () => {
                    await runAction("planning-client", async () =>
                      markPracticeClientTriedAction({ runId: run.id }),
                    );
                  }}
                  onReviewed={async () => {
                    await runAction("planning-review", async () =>
                      markPracticePlanningReviewedAction({ runId: run.id }),
                    );
                  }}
                />
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StageMeetInquiry({
  leadHref,
  busy,
  complete,
  onOpen,
  onConfirm,
}: {
  leadHref: string | null;
  busy: string | null;
  complete: boolean;
  onOpen: () => Promise<void>;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {leadHref ? (
        <Button
          type="button"
          disabled={Boolean(busy)}
          render={
            <Link
              href={leadHref}
              data-testid="practice-open-sample-inquiry"
              onClick={() => {
                void onOpen();
              }}
            />
          }
        >
          Open sample inquiry
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        disabled={Boolean(busy) || complete}
        onClick={() => void onConfirm()}
        data-testid="practice-confirm-explored-inquiry"
      >
        {busy === "meet-confirm" ? "Saving…" : "I've explored this inquiry"}
      </Button>
    </div>
  );
}

function StagePrepareProposal({
  run,
  leadHref,
  venuePackages,
  busy,
  onBegin,
  onSave,
  onDeliver,
  onSimulateSelection,
}: {
  run: PracticeRun;
  leadHref: string | null;
  venuePackages: { id: string; name: string; basePrice: number | null }[];
  busy: string | null;
  onBegin: () => Promise<void>;
  onSave: (packageId: string | null) => Promise<void>;
  onDeliver: () => Promise<void>;
  onSimulateSelection: () => Promise<void>;
}) {
  const [packageId, setPackageId] = React.useState<string>(venuePackages[0]?.id ?? "");
  const proposal = run.journey.proposal;
  const usingFallback = venuePackages.length === 0;

  return (
    <div className="space-y-3">
      {usingFallback ? (
        <p
          className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
          data-testid="practice-package-fallback-note"
        >
          Your venue does not have packages yet. A clearly labeled practice-only example package
          will be used for this walkthrough. It will not be added to your permanent package library.
        </p>
      ) : (
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-heading">Choose a package</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            data-testid="practice-package-select"
          >
            {venuePackages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name}
                {pkg.basePrice != null ? ` — $${pkg.basePrice.toLocaleString()}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => {
            void onSave(usingFallback ? null : packageId || null);
          }}
          data-testid="practice-prepare-sample-proposal"
        >
          {busy === "proposal-save" ? "Saving…" : "Prepare sample proposal"}
        </Button>
        {leadHref ? (
          <Button
            type="button"
            variant="outline"
            render={<Link href={leadHref} data-testid="practice-explore-proposal-tools" />}
            onClick={() => {
              void onBegin();
            }}
          >
            Explore proposal tools
          </Button>
        ) : null}
      </div>

      {proposal ? (
        <div
          className="space-y-2 rounded-lg border border-border bg-muted/15 px-3 py-3 text-sm"
          data-testid="practice-proposal-snapshot"
        >
          <p className="font-medium text-heading">{proposal.packageName}</p>
          <p className="text-muted-foreground">
            {proposal.packageSource === "practice_fallback" ? "Practice-only example · " : ""}
            ${proposal.totalAmount.toLocaleString()} total · ${proposal.depositAmount.toLocaleString()}{" "}
            deposit
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {proposal.includedItems.slice(0, 5).map((item) => (
              <li key={`${item.description}-${item.quantity}`}>{item.description}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              size="sm"
              disabled={Boolean(busy) || Boolean(proposal.simulatedDeliveryAt)}
              onClick={() => void onDeliver()}
              data-testid="practice-simulate-proposal-delivery"
            >
              {proposal.simulatedDeliveryAt ? "Proposal ready" : "Send proposal (Practice Mode)"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busy) || Boolean(proposal.clientSelectionSimulatedAt)}
              onClick={() => void onSimulateSelection()}
              data-testid="practice-simulate-client-selection"
            >
              {proposal.clientSelectionSimulatedAt
                ? "Client selection simulated"
                : "Simulate client selection"}
            </Button>
          </div>
          {proposal.simulatedDeliveryAt ? (
            <div
              className="rounded-md border border-border bg-card px-3 py-2"
              data-testid="practice-proposal-ready-confirmation"
            >
              <p className="font-medium text-heading">Proposal ready for Maya &amp; Jordan</p>
              <p className="text-muted-foreground">
                This is what sending a proposal looks like. In Practice Run, nothing was delivered to
                a real person.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StageCreateAgreement({
  run,
  venueContractTemplates,
  busy,
  onBegin,
  onPrepare,
  onAdvance,
}: {
  run: PracticeRun;
  venueContractTemplates: { id: string; name: string }[];
  busy: string | null;
  onBegin: () => Promise<void>;
  onPrepare: (templateName: string | null, templateSource: "venue" | "practice_fallback") => Promise<void>;
  onAdvance: () => Promise<void>;
}) {
  const contract = run.journey.contract;
  const usingFallback = venueContractTemplates.length === 0;
  const [templateId, setTemplateId] = React.useState(venueContractTemplates[0]?.id ?? "");
  const contractNewHref =
    run.sampleClientId
      ? `/contracts/new?clientId=${encodeURIComponent(run.sampleClientId)}${
          run.sampleEventId ? `&eventId=${encodeURIComponent(run.sampleEventId)}` : ""
        }`
      : null;

  return (
    <div className="space-y-3">
      {usingFallback ? (
        <p
          className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
          data-testid="practice-contract-fallback-note"
        >
          Your venue does not have a contract template yet. A practice-only example agreement will be
          used. It will not change your permanent template library.
        </p>
      ) : (
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-heading">Choose a contract template</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            data-testid="practice-contract-template-select"
          >
            {venueContractTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => {
            const selected = venueContractTemplates.find((t) => t.id === templateId);
            void onPrepare(
              selected?.name ?? null,
              usingFallback ? "practice_fallback" : "venue",
            );
          }}
          data-testid="practice-prepare-sample-contract"
        >
          {busy === "contract-prepare" ? "Preparing…" : "Prepare sample contract"}
        </Button>
        {contractNewHref ? (
          <Button
            type="button"
            variant="outline"
            render={<Link href={contractNewHref} data-testid="practice-explore-contract-tools" />}
            onClick={() => {
              void onBegin();
            }}
          >
            Open contract builder
          </Button>
        ) : null}
      </div>

      {contract ? (
        <div
          className="space-y-2 rounded-lg border border-border bg-muted/15 px-3 py-3 text-sm"
          data-testid="practice-contract-snapshot"
        >
          <p className="font-medium text-heading">{contract.templateName}</p>
          <p className="text-muted-foreground">
            {contract.templateSource === "practice_fallback" ? "Practice-only example · " : ""}
            Simulated status:{" "}
            <span data-testid="practice-contract-sim-status">
              {contractSimStatusLabel(contract.simulatedStatus)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Client signs first. Venue countersigns second. Fully executed agreements are locked.
            These steps are simulations — no genuine electronic signatures are created.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={Boolean(busy) || Boolean(contract.exploredSequenceAt)}
            onClick={() => void onAdvance()}
            data-testid="practice-advance-contract-simulation"
          >
            {contract.exploredSequenceAt
              ? "Signing sequence explored"
              : `Simulate next step (${contractSimStatusLabel(contract.simulatedStatus)})`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StageGetReady({
  run,
  eventHref,
  busy,
  onBook,
  onBegin,
}: {
  run: PracticeRun;
  eventHref: string | null;
  busy: string | null;
  onBook: () => Promise<void>;
  onBegin: () => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Practice-booked celebrations stay outside your live calendar, SaaS volume, and dashboard
        booked counts.
        {run.practiceBookedAt
          ? " This sample is already practice-booked."
          : " Mark it practice-booked, then open the real celebration workspace."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!run.practiceBookedAt ? (
          <Button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void onBook()}
            data-testid="practice-book-celebration"
          >
            {busy === "practice-book" ? "Updating…" : "Mark practice-booked"}
          </Button>
        ) : (
          <Badge variant="default" data-testid="practice-booked-badge">
            Practice-booked
          </Badge>
        )}
        {eventHref ? (
          <Button
            type="button"
            render={<Link href={eventHref} data-testid="practice-explore-sample-celebration" />}
            onClick={() => {
              void onBegin();
            }}
          >
            Explore sample celebration
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function sourceLabel(source: string): string {
  switch (source) {
    case "venue_configured":
      return "From your venue setup";
    case "venue_template":
      return "From your templates";
    case "htc_starter":
      return "Hello to Cheers starter";
    default:
      return "Practice-only example";
  }
}

function StageExplorePlanning({
  run,
  busy,
  complete,
  planningHref,
  onBegin,
  onPrepare,
  onShare,
  onClientTried,
  onReviewed,
}: {
  run: PracticeRun;
  busy: string | null;
  complete: boolean;
  planningHref: (run: PracticeRun, hash: string) => string | null;
  onBegin: () => Promise<void>;
  onPrepare: () => Promise<void>;
  onShare: () => Promise<void>;
  onClientTried: () => Promise<void>;
  onReviewed: () => Promise<void>;
}) {
  const planning = run.journey.planning;
  const clientHref = `/practice-run/${encodeURIComponent(run.id)}/client`;
  const destinations: { label: string; hash: string; testId: string }[] = [
    { label: "Planning Overview", hash: "overview", testId: "practice-link-overview" },
    { label: "Planning Tasks", hash: "playbook", testId: "practice-link-tasks" },
    { label: "Timeline", hash: "timeline", testId: "practice-link-timeline" },
    { label: "Floor Plans and Seating", hash: "floorplan", testId: "practice-link-floorplan" },
    { label: "Event Order", hash: "event-order", testId: "practice-link-event-order" },
    { label: "Inventory", hash: "inventory", testId: "practice-link-inventory" },
    { label: "Questionnaires", hash: "questionnaires", testId: "practice-link-questionnaires" },
    { label: "Documents", hash: "documents", testId: "practice-link-documents" },
    { label: "Vendors", hash: "vendors", testId: "practice-link-vendors" },
    { label: "Payments overview", hash: "invoice", testId: "practice-link-payments" },
  ];

  type PlanningStepId = "prepare" | "share" | "explore" | "review";
  const currentStep: PlanningStepId = !run.practiceBookedAt || !planning?.preparedAt
    ? "prepare"
    : !planning.sharedAt
      ? "share"
      : !planning.clientTriedAt && !complete
        ? "explore"
        : "review";

  const steps: { id: PlanningStepId; label: string }[] = [
    { id: "prepare", label: "Prepare" },
    { id: "share", label: "Share" },
    { id: "explore", label: "Explore as Client" },
    { id: "review", label: "Review" },
  ];
  const stepIndex = steps.findIndex((s) => s.id === currentStep);

  function stepPill(step: { id: PlanningStepId; label: string }, index: number, opts?: { showTestId?: boolean }) {
    const isCurrent = step.id === currentStep;
    const isDone = index < stepIndex || (step.id === "review" && complete);
    return (
      <span
        className={
          isCurrent
            ? "rounded-full bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1 text-xs font-semibold text-heading ring-1 ring-[color:var(--htc-eucalyptus)]"
            : isDone
              ? "rounded-full px-2.5 py-1 text-xs font-medium text-heading"
              : "rounded-full px-2.5 py-1 text-xs text-muted-foreground"
        }
        data-testid={opts?.showTestId === false ? undefined : `practice-planning-step-${step.id}`}
        data-active={isCurrent ? "true" : "false"}
      >
        {step.label}
      </span>
    );
  }

  function stepArrow() {
    return (
      <span className="px-0.5 text-xs text-muted-foreground" aria-hidden>
        →
      </span>
    );
  }

  return (
    <div className="space-y-5" data-testid="practice-planning-collaboration">
      <nav
        aria-label="Planning collaboration progress"
        data-testid="practice-planning-steps"
        data-current-step={currentStep}
      >
        {/* Mobile: deliberate two-row balance — Prepare→Share / Explore→Review */}
        <div
          className="flex flex-col items-center gap-2 sm:hidden"
          data-testid="practice-planning-steps-mobile"
        >
          <div className="flex items-center justify-center gap-1">
            {stepPill(steps[0], 0, { showTestId: false })}
            {stepArrow()}
            {stepPill(steps[1], 1, { showTestId: false })}
          </div>
          <div className="flex items-center justify-center gap-1">
            {stepPill(steps[2], 2, { showTestId: false })}
            {stepArrow()}
            {stepPill(steps[3], 3, { showTestId: false })}
          </div>
        </div>
        {/* Desktop: single progressive row (owns step test ids) */}
        <div
          className="hidden flex-wrap items-center gap-x-1 gap-y-2 sm:flex"
          data-testid="practice-planning-steps-desktop"
        >
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-1">
              {index > 0 ? stepArrow() : null}
              {stepPill(step, index)}
            </div>
          ))}
        </div>
      </nav>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {currentStep === "prepare" ? (
          <Button
            type="button"
            disabled={Boolean(busy) || !run.practiceBookedAt}
            onClick={() => void onPrepare()}
            data-testid="practice-prepare-planning"
          >
            {busy === "planning-prepare"
              ? "Preparing…"
              : planning?.preparedAt
                ? "Refresh planning resources"
                : "Prepare planning resources"}
          </Button>
        ) : null}
        {currentStep === "share" ? (
          <Button
            type="button"
            disabled={Boolean(busy) || !planning?.preparedAt}
            onClick={() => void onShare()}
            data-testid="practice-share-planning"
          >
            {busy === "planning-share"
              ? "Sharing…"
              : planning?.sharedAt
                ? "Shared with Client"
                : "Share with Client perspective"}
          </Button>
        ) : null}
        {currentStep === "explore" ? (
          <Button
            type="button"
            disabled={Boolean(busy) || !planning?.sharedAt}
            render={<Link href={clientHref} data-testid="practice-open-client-planning" />}
            onClick={() => {
              void onClientTried();
            }}
          >
            Open Client perspective
          </Button>
        ) : null}
        {currentStep === "review" ? (
          <Button
            type="button"
            disabled={Boolean(busy) || complete || !planning?.preparedAt}
            onClick={() => void onReviewed()}
            data-testid="practice-finish-planning-review"
          >
            {busy === "planning-review" ? "Saving…" : "I've reviewed client updates"}
          </Button>
        ) : null}

        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {currentStep !== "prepare" && run.practiceBookedAt ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={Boolean(busy)}
              onClick={() => void onPrepare()}
              data-testid="practice-prepare-planning"
            >
              {busy === "planning-prepare" ? "Preparing…" : "Refresh resources"}
            </Button>
          ) : null}
          {currentStep !== "share" && planning?.preparedAt ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={Boolean(busy)}
              onClick={() => void onShare()}
              data-testid="practice-share-planning"
            >
              {planning?.sharedAt ? "Shared" : "Share"}
            </Button>
          ) : null}
          {currentStep !== "explore" && planning?.sharedAt ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={Boolean(busy)}
              render={<Link href={clientHref} data-testid="practice-open-client-planning" />}
              onClick={() => {
                void onClientTried();
              }}
            >
              Client view
            </Button>
          ) : null}
          {currentStep !== "review" && planning?.preparedAt && !complete ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={Boolean(busy)}
              onClick={() => void onReviewed()}
              data-testid="practice-finish-planning-review"
            >
              Mark reviewed
            </Button>
          ) : null}
        </div>
      </div>

      {!run.practiceBookedAt ? (
        <p className="text-sm text-muted-foreground">
          Mark the celebration practice-booked in the previous step before preparing planning
          resources.
        </p>
      ) : null}

      {planning?.preparedAt ? (
        <div
          className="space-y-2 rounded-lg border border-border bg-muted/15 px-3 py-3 text-sm"
          data-testid="practice-planning-snapshot"
        >
          <p className="font-medium text-heading">Prepared for this Practice Run</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Tasks: {planning.counts.tasks} · {sourceLabel(planning.sources.tasks)}
            </li>
            <li>
              Timeline: {planning.counts.timeline} · {sourceLabel(planning.sources.timeline)}
            </li>
            <li>
              Documents ready to share: {planning.counts.documentsShared} · Venue-only:{" "}
              {planning.counts.documentsPrivate}
            </li>
            <li>
              Questionnaire: {planning.counts.questionnaires > 0 ? "Prepared" : "Not yet"} ·{" "}
              {sourceLabel(planning.sources.questionnaire)}
            </li>
            <li>
              Wedding website: {planning.resourceIds.websiteId ? "Draft ready (not published)" : "—"}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            {planning.sharedAt
              ? "Shared resources follow real release rules. Unshared drafts stay hidden from the couple."
              : "Prepared resources are not yet visible to the couple until you share them."}
          </p>
        </div>
      ) : null}

      <div className="space-y-2" data-testid="practice-planning-destinations">
        <p className="text-sm font-medium text-heading">Explore the planning tools</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {destinations.map((dest) => {
            const href = planningHref(run, dest.hash);
            if (!href) return null;
            return (
              <Button
                key={dest.hash}
                type="button"
                size="sm"
                variant="outline"
                className="justify-start"
                render={<Link href={href} data-testid={dest.testId} />}
                onClick={() => {
                  void onBegin();
                }}
              >
                {dest.label}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          These open the real sample Event tools. Practice-linked changes stay isolated. Payments show
          sample information only — nothing is charged or synced.
        </p>
      </div>
    </div>
  );
}
