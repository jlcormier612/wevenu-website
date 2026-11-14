"use client";

/**
 * Preview as Client — interactive couple experience over a template freeze.
 * Local answers only. Does not save, send, book, invoice, or mutate the template.
 */
import * as React from "react";
import Link from "next/link";

import { ChoicesInteractiveForm } from "@/components/client-choices/choices-interactive-form";
import { Button } from "@/components/ui/button";
import { reconcileAnswersForDependencies } from "@/lib/client-choices/conditional-groups";
import type { ChoicesAnswers } from "@/lib/client-choices/types";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import {
  COMPLETENESS_INTRO,
  groupedCompletenessGuidance,
} from "@/lib/event-order-templates/commercial-state";
import { sectionEditorHref } from "@/lib/event-order-templates/editor-presentation";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import { sectionCompletenessIssues } from "@/lib/event-order-templates/section-workspace";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

export function EventOrderClientPreview({
  template,
}: {
  template: EventOrderTemplateWithDetails;
}) {
  const definition = React.useMemo(
    () => selectionDefinitionFromEventOrderTemplate(template),
    [template],
  );
  const [answers, setAnswers] = React.useState<ChoicesAnswers>({});
  const [message, setMessage] = React.useState<string | null>(null);
  const [messageTone, setMessageTone] = React.useState<"info" | "error">("info");
  const issues = sectionCompletenessIssues(template.groups, template.options);
  const guidance = groupedCompletenessGuidance(
    template.sections,
    template.groups,
    template.options,
  );

  function checkSelections() {
    const reconciled = reconcileAnswersForDependencies(definition, answers);
    const result = validateChoicesAnswers(definition, reconciled);
    if (result.ok) {
      setMessageTone("info");
      setMessage("These selections would meet the same rules a client sees before submitting.");
      return;
    }
    setMessageTone("error");
    setMessage(result.message);
  }

  return (
    <article className="w-full space-y-6 overflow-x-hidden" data-testid="eo-client-preview">
      <header className="space-y-1.5">
        <p
          className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
          data-testid="client-preview-badge"
        >
          Client Preview
        </p>
        <h1 className="font-heading text-2xl font-medium text-heading">{template.name}</h1>
        {template.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{template.description}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          This is a preview of the choices a client would see. Selections stay on this page and are
          not saved, sent, or billed.
        </p>
      </header>

      {issues.length > 0 ? (
        <div
          className="rounded-md border border-border bg-muted/20 px-3 py-2.5 text-sm"
          data-testid="eo-client-preview-incomplete"
        >
          <p className="font-medium text-heading">{COMPLETENESS_INTRO}</p>
          <div className="mt-2 space-y-2">
            {guidance.map((section) => (
              <div key={section.sectionId ?? section.sectionName}>
                {section.sectionId ? (
                  <Link
                    href={sectionEditorHref(template.id, section.sectionId)}
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-heading underline-offset-2 hover:underline"
                    data-testid={`eo-completeness-section-${section.sectionId}`}
                  >
                    {section.sectionName}
                  </Link>
                ) : (
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-heading">
                    {section.sectionName}
                  </p>
                )}
                <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
                  {section.lines.map((line) => (
                    <li key={`${line.groupId}:${line.text}`}>{line.text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {definition.groups.length === 0 && (definition.fixedLines?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No client choices are on this template yet.</p>
      ) : (
        <ChoicesInteractiveForm
          definition={definition}
          answers={answers}
          priceSurface="preview"
          onAnswersChange={(next) => {
            setAnswers(next);
            setMessage(null);
          }}
          onBlocked={(blocked) => {
            if (blocked) {
              setMessageTone("error");
              setMessage(blocked);
            } else {
              setMessage(null);
            }
          }}
        />
      )}

      {definition.groups.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="eo-client-preview-check"
            onClick={checkSelections}
          >
            Check selections
          </Button>
          {message ? (
            <p
              className={`text-sm ${messageTone === "error" ? "text-destructive" : "text-muted-foreground"}`}
              data-testid={messageTone === "error" ? "eo-client-preview-error" : "eo-client-preview-message"}
              role={messageTone === "error" ? "alert" : undefined}
            >
              {message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Uses the same selection rules as the client portal. Nothing is submitted.
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}
