"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CutoverPrerequisite } from "@/lib/setup-hub/bring-your-business";
import { BRING_YOUR_BUSINESS_ROUTES } from "@/lib/setup-hub/bring-your-business";
import {
  BRING_YOUR_BUSINESS_GUIDE_STEPS,
  BRING_YOUR_BUSINESS_WILL_NOT,
  BRING_YOUR_BUSINESS_WILL_NOT_DO_AUTOMATICALLY,
  guideStatusLabel,
  type GuideCategory,
  type GuideStepStatus,
  type BringYourBusinessGuideStepId,
} from "@/lib/setup-hub/bring-your-business-guide";

function StatusBadge({ status }: { status: GuideStepStatus }) {
  if (status === "imported") {
    return <Badge variant="outline" className="htc-badge-active">{guideStatusLabel(status)}</Badge>;
  }
  if (status === "needs_attention") {
    return <Badge variant="outline">{guideStatusLabel(status)}</Badge>;
  }
  return <Badge variant="outline">{guideStatusLabel(status)}</Badge>;
}

function CategoryDetails({ category }: { category: GuideCategory }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-md border border-border bg-card/60">
      <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-heading">{category.title}</p>
          <p className="text-xs text-muted-foreground">{category.summary}</p>
          {category.dependsOn ? (
            <p className="text-xs text-muted-foreground">
              {category.dependsOn.label}{" "}
              <Link href={category.dependsOn.href} className="font-medium text-primary hover:underline">
                {category.dependsOn.hrefLabel}
              </Link>
            </p>
          ) : null}
        </div>
        <Link
          href={category.href}
          className="htc-setup-quiet-action inline-flex shrink-0 items-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1.5 text-xs font-medium text-heading"
        >
          {category.hrefLabel}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <button
        type="button"
        className="flex w-full items-center justify-between border-t border-border px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>What to prepare</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <dl className="space-y-2 border-t border-border px-3 py-3 text-xs text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">What can be imported</dt>
            <dd className="mt-0.5">{category.canImport}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Accepted files</dt>
            <dd className="mt-0.5">{category.fileTypes}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Required</dt>
            <dd className="mt-0.5">{category.required}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Optional</dt>
            <dd className="mt-0.5">{category.optional}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Template</dt>
            <dd className="mt-0.5">{category.template}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Duplicates and updates</dt>
            <dd className="mt-0.5">{category.duplicates}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Afterward</dt>
            <dd className="mt-0.5">{category.afterward}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

export function BringYourBusinessGuide({
  progress,
  cutover,
  isWhiteGlove,
}: {
  progress: Record<BringYourBusinessGuideStepId, GuideStepStatus>;
  cutover: CutoverPrerequisite;
  isWhiteGlove: boolean;
}) {
  return (
    <div className="space-y-6" data-testid="bring-your-business-guide">
      <div className="htc-surface-guidance space-y-2 px-4 py-3">
        <p className="text-sm text-foreground">
          Bring over what you already have, then get it ready to manage here. This is a recommended
          order — you can import any supported category on its own, leave, and come back.
        </p>
        <p className="text-sm text-muted-foreground">
          {BRING_YOUR_BUSINESS_WILL_NOT_DO_AUTOMATICALLY}
        </p>
        {isWhiteGlove ? (
          <p className="text-sm text-muted-foreground">
            White Glove includes personal help with this work. These tools are still yours to use —
            the paid service is not required for import.
          </p>
        ) : null}
      </div>

      {cutover.message ? (
        <p className="text-sm text-muted-foreground" data-testid="byb-guide-cutover-hint">
          {cutover.message}{" "}
          <Link href={BRING_YOUR_BUSINESS_ROUTES.calendarAvailability} className="font-medium text-primary hover:underline">
            Open Availability &amp; Capacity
          </Link>
        </p>
      ) : null}

      <div className="htc-surface-guidance space-y-2 px-4 py-3">
        <p className="text-sm font-medium text-heading">Hello to Cheers will not automatically</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {BRING_YOUR_BUSINESS_WILL_NOT.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <ol className="space-y-6">
        {BRING_YOUR_BUSINESS_GUIDE_STEPS.map((step) => {
          const status = progress[step.id];
          return (
            <li key={step.id} id={`byb-step-${step.id}`} className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Step {step.number}
                  </p>
                  <h2 className="text-base font-medium text-heading">{step.title}</h2>
                  <p className="text-sm text-muted-foreground">{step.summary}</p>
                </div>
                <StatusBadge status={status} />
              </div>
              <div className="space-y-2">
                {step.categories.map((category) => (
                  <CategoryDetails key={category.id} category={category} />
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      <Card>
        <CardContent className="space-y-2 py-4">
          <p className="text-sm font-medium text-heading">Prefer the underlying tools?</p>
          <p className="text-xs text-muted-foreground">
            Import Data and Migration Center are the same importers this guide opens. You do not need
            both unless you want them.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href={BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Import Data
              <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              href={BRING_YOUR_BUSINESS_ROUTES.migrationCenter}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Migration Center
              <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              href="/setup-hub"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Back to Setup
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
