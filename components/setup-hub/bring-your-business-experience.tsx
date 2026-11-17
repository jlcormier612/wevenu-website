"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { setBringYourBusinessPathAction } from "@/app/(app)/setup-hub/actions";
import { Button } from "@/components/ui/button";
import type { CutoverPrerequisite } from "@/lib/setup-hub/bring-your-business";
import {
  BRING_YOUR_BUSINESS_ROUTES,
  bringYourBusinessHref,
  type BringYourBusinessStage,
} from "@/lib/setup-hub/bring-your-business";
import type { GuideStepStatus } from "@/lib/setup-hub/bring-your-business-guide";
import {
  BYB_CANNOT_IMPORT,
  BYB_CONTINUE_LABEL,
  BYB_ENTRY_CHOICES,
  BYB_ENTRY_HEADLINE,
  BYB_ENTRY_STAGES_NOTE,
  BYB_ENTRY_SUPPORTING,
  BYB_PREPARE_CHECKLIST,
  BYB_PREPARE_INTRO_FILES,
  BYB_PREPARE_INTRO_IMPORT,
  BYB_STAGE_COPY,
  BYB_CONTINUE_WITHOUT_MORE_IMPORTS,
  BYB_REVIEW_ATTENTION,
  BYB_REVIEW_BROUGHT_OVER,
  BYB_REVIEW_NOTE,
  BYB_REVIEW_SKIPPED,
  BYB_STAGE_NAV_LABELS,
  BYB_STARTING_FRESH,
  BYB_WORKFLOW_STAGES,
  buildBringYourBusinessReview,
  continueBringYourBusinessStage,
  nextBringYourBusinessStage,
  previousBringYourBusinessStage,
} from "@/lib/setup-hub/bring-your-business-journey";

export type BringYourBusinessReadiness = {
  imported: number;
  skipped: number;
  errors: number;
  hasMigrationImport: boolean;
  leads: GuideStepStatus;
  clients: GuideStepStatus;
  vendors: GuideStepStatus;
  money: GuideStepStatus;
  planning: GuideStepStatus;
};

function StageNav({
  stage,
  extra,
}: {
  stage: Exclude<BringYourBusinessStage, "entry">;
  extra?: Record<string, string>;
}) {
  const back = previousBringYourBusinessStage(stage);
  const next = nextBringYourBusinessStage(stage);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <Link
        href={bringYourBusinessHref(back, extra)}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-heading"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Back
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        {stage !== "review" ? (
          <Link
            href={bringYourBusinessHref(next, extra)}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            data-testid="byb-skip-stage"
          >
            Skip this for now
          </Link>
        ) : null}
        {stage !== "review" ? (
          <Link
            href={bringYourBusinessHref(next, extra)}
            className="htc-setup-quiet-action inline-flex items-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1.5 text-xs font-medium text-heading"
            data-testid="byb-continue-stage"
          >
            Continue
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : (
          <Link
            href="/setup-hub"
            className="htc-setup-quiet-action inline-flex items-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1.5 text-xs font-medium text-heading"
          >
            Back to Setup
            <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function StartFreshButton({
  afterImports,
}: {
  afterImports: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const copy = afterImports ? BYB_CONTINUE_WITHOUT_MORE_IMPORTS : BYB_STARTING_FRESH;
  return (
    <div
      className="htc-surface-guidance space-y-2 p-4"
      data-testid={afterImports ? "byb-choice-continue-setup" : "byb-choice-fresh"}
    >
      <p className="text-sm font-medium text-heading">{copy.title}</p>
      <p className="text-xs text-muted-foreground">{copy.description}</p>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        data-testid="byb-starting-fresh"
        onClick={() => {
          startTransition(async () => {
            await setBringYourBusinessPathAction("skipped");
            router.push("/setup-hub");
          });
        }}
      >
        {copy.action}
      </Button>
    </div>
  );
}

function StageRail({
  stage,
  extra,
}: {
  stage: Exclude<BringYourBusinessStage, "entry">;
  extra?: Record<string, string>;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const currentRef = React.useRef<HTMLLIElement>(null);
  const [moreLeft, setMoreLeft] = React.useState(false);
  const [moreRight, setMoreRight] = React.useState(false);

  const updateCue = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setMoreLeft(el.scrollLeft > 4);
    setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scrollCurrentIntoView = React.useCallback(() => {
    const scroller = scrollerRef.current;
    const current = currentRef.current;
    if (!scroller || !current) return;
    const s = scroller.getBoundingClientRect();
    const c = current.getBoundingClientRect();
    if (c.right > s.right - 28) {
      scroller.scrollLeft += c.right - s.right + 28;
    } else if (c.left < s.left + 8) {
      scroller.scrollLeft -= s.left - c.left + 8;
    }
    updateCue();
  }, [updateCue]);

  React.useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    scrollCurrentIntoView();
    const frame = requestAnimationFrame(() => requestAnimationFrame(scrollCurrentIntoView));
    const observer = new ResizeObserver(scrollCurrentIntoView);
    observer.observe(el);
    const list = el.querySelector("ol");
    if (list) observer.observe(list);
    el.addEventListener("scroll", updateCue, { passive: true });
    window.addEventListener("resize", scrollCurrentIntoView);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("scroll", updateCue);
      window.removeEventListener("resize", scrollCurrentIntoView);
    };
  }, [stage, scrollCurrentIntoView, updateCue]);

  return (
    <div className="relative w-full min-w-0 max-w-[calc(100vw-1.5rem)] md:max-w-full">
      <div
        ref={scrollerRef}
        className="w-full min-w-0 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        data-testid="byb-stage-rail"
        data-overflow={moreLeft || moreRight ? "true" : "false"}
        aria-label="Bring your business stages"
      >
        <ol className="flex w-max max-w-none items-center gap-1 text-xs">
          {BYB_WORKFLOW_STAGES.map((id, index) => (
            <li key={id} ref={id === stage ? currentRef : undefined} className="shrink-0">
              <Link
                href={bringYourBusinessHref(id, extra)}
                className={
                  id === stage
                    ? "inline-flex items-center rounded-full bg-heading px-2.5 py-1 font-medium text-background"
                    : "inline-flex items-center rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground"
                }
                aria-current={id === stage ? "step" : undefined}
              >
                {index + 1}. {BYB_STAGE_NAV_LABELS[id]}
              </Link>
            </li>
          ))}
        </ol>
      </div>
      {moreLeft ? (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center bg-gradient-to-r from-background via-background/90 to-transparent pl-0.5"
          data-testid="byb-stage-rail-more-left"
          aria-hidden
        >
          <span className="rounded-full bg-background/95 text-heading shadow-sm">
            <ChevronLeft className="size-3.5" />
          </span>
        </div>
      ) : null}
      {moreRight ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-end bg-gradient-to-l from-background via-background/90 to-transparent pr-0.5"
          data-testid="byb-stage-rail-more"
          aria-hidden
        >
          <span className="rounded-full bg-background/95 text-heading shadow-sm">
            <ChevronRight className="size-3.5" />
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function BringYourBusinessExperience({
  stage,
  entryLane,
  cutover,
  hasExistingWork,
  isWhiteGlove,
  readiness,
  children,
}: {
  stage: BringYourBusinessStage;
  entryLane: "import" | "files" | null;
  cutover: CutoverPrerequisite;
  hasExistingWork: boolean;
  isWhiteGlove: boolean;
  readiness: BringYourBusinessReadiness;
  children?: React.ReactNode;
}) {
  const extra = entryLane ? { entry: entryLane } : undefined;
  const continueStage = continueBringYourBusinessStage({
    leads: readiness.leads,
    clients: readiness.clients,
    vendors: readiness.vendors,
    "packages-financials": readiness.money,
    planning: readiness.planning,
  });
  const reviewGroups = stage === "review" ? buildBringYourBusinessReview(readiness) : null;

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6" data-testid="bring-your-business-experience">
      <Link
        href="/setup-hub"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-heading"
        data-testid="byb-back-to-setup"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Back to Setup
      </Link>

      {stage === "entry" ? (
        <div className="space-y-6" data-testid="byb-entry">
          <div className="htc-hospitality-heading htc-hospitality-intro-accent space-y-2">
            <h1 className="font-heading text-3xl font-medium tracking-tight text-heading">
              {BYB_ENTRY_HEADLINE}
            </h1>
            <p className="text-sm text-muted-foreground">{BYB_ENTRY_SUPPORTING}</p>
            <p className="text-sm text-muted-foreground">{BYB_ENTRY_STAGES_NOTE}</p>
          </div>

          {hasExistingWork ? (
            <div className="htc-surface-guidance space-y-2 p-4" data-testid="byb-continue-existing">
              <p className="text-sm font-medium text-heading">You already started bringing information over.</p>
              <p className="text-xs text-muted-foreground">
                Imported {readiness.imported}
                {readiness.skipped > 0 ? ` · ${readiness.skipped} skipped` : ""}
                {readiness.errors > 0 ? ` · ${readiness.errors} need attention` : ""}
              </p>
              <Link
                href={bringYourBusinessHref(continueStage, extra)}
                className="htc-setup-quiet-action inline-flex items-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1.5 text-xs font-medium text-heading"
                data-testid="byb-continue-existing-cta"
              >
                {BYB_CONTINUE_LABEL}
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          ) : null}

          <div className="grid gap-3">
            {BYB_ENTRY_CHOICES.map((choice) => (
              <Link
                key={choice.id}
                href={choice.href}
                className="htc-surface-guidance flex items-start justify-between gap-3 p-4 hover:border-primary"
                data-testid={`byb-choice-${choice.id}`}
              >
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-heading">{choice.title}</span>
                  <span className="block text-xs text-muted-foreground">{choice.description}</span>
                </span>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            <StartFreshButton afterImports={hasExistingWork} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <StageRail stage={stage} extra={extra} />

          <div className="htc-hospitality-heading htc-hospitality-intro-accent space-y-2">
            <h1 className="font-heading text-3xl font-medium tracking-tight text-heading">
              {BYB_STAGE_COPY[stage].title}
            </h1>
            <p className="text-sm text-muted-foreground">{BYB_STAGE_COPY[stage].summary}</p>
            {isWhiteGlove ? (
              <p className="text-sm text-muted-foreground">
                White Glove includes personal help with this work. These tools are still yours to use.
              </p>
            ) : null}
          </div>

          {stage === "prepare" ? (
            <div className="space-y-4" data-testid="byb-prepare">
              <p className="text-sm text-muted-foreground">
                {entryLane === "files" ? BYB_PREPARE_INTRO_FILES : BYB_PREPARE_INTRO_IMPORT}
              </p>
              {cutover.message ? (
                <p className="text-sm text-amber-800 dark:text-amber-200" data-testid="byb-cutover-hint">
                  {cutover.message}{" "}
                  <Link
                    href={`${BRING_YOUR_BUSINESS_ROUTES.calendarAvailability}?from=setup-hub`}
                    className="font-medium underline"
                  >
                    Open Calendar &amp; Availability
                  </Link>
                  {", then return here."}
                </p>
              ) : null}
              <ul className="space-y-2">
                {BYB_PREPARE_CHECKLIST.map((row) => (
                  <li key={row.label} className="htc-surface-guidance space-y-1 p-3">
                    <p className="text-sm font-medium text-heading">{row.label}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {row.support === "supported"
                        ? "Supported"
                        : row.support === "optional"
                          ? "Optional"
                          : "Needs manual setup"}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.detail}</p>
                  </li>
                ))}
              </ul>
              <div className="htc-surface-guidance space-y-2 p-3">
                <p className="text-sm font-medium text-heading">Hello to Cheers will not import</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {BYB_CANNOT_IMPORT.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {stage === "review" && reviewGroups ? (
            <div className="space-y-3" data-testid="byb-readiness">
                    <div className="htc-surface-guidance space-y-2 p-4" data-testid="byb-review-brought-over">
                      <p className="text-sm font-medium text-heading">{BYB_REVIEW_BROUGHT_OVER}</p>
                      {reviewGroups.broughtOver.length > 0 ? (
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {reviewGroups.broughtOver.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nothing has been imported yet.</p>
                      )}
                    </div>
                    {reviewGroups.skipped.length > 0 ? (
                      <div className="htc-surface-guidance space-y-2 p-4" data-testid="byb-review-skipped">
                        <p className="text-sm font-medium text-heading">{BYB_REVIEW_SKIPPED}</p>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {reviewGroups.skipped.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="htc-surface-guidance space-y-2 p-4" data-testid="byb-review-attention">
                      <p className="text-sm font-medium text-heading">{BYB_REVIEW_ATTENTION}</p>
                      {reviewGroups.attention.length > 0 ? (
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {reviewGroups.attention.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
                      )}
                      <p className="text-xs text-muted-foreground">{BYB_REVIEW_NOTE}</p>
                    </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href="/clients" className="font-medium text-primary hover:underline">
                  Open All Bookings
                </Link>
                <Link href="/clients?filter=past" className="font-medium text-primary hover:underline">
                  Open Past
                </Link>
                <Link href="/calendar" className="font-medium text-primary hover:underline">
                  Open Calendar
                </Link>
                <Link href="/leads" className="font-medium text-primary hover:underline">
                  Open Leads
                </Link>
              </div>
            </div>
          ) : null}

          {children}

          <StageNav stage={stage} extra={extra} />
        </div>
      )}
    </div>
  );
}
