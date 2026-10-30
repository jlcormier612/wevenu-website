"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  financialDeltaFromLines,
  resolveSelectedOptions,
} from "@/lib/client-choices/apply-to-event-order";
import {
  orderedVisibleChoiceGroups,
  reconcileAnswersForDependencies,
} from "@/lib/client-choices/conditional-groups";
import {
  isAtSelectionMaximum,
  selectionMaximumReachedMessage,
  selectionProgressForGroup,
} from "@/lib/client-choices/selection-progress";
import type { ChoicesAnswers, ChoicesDefinitionGroup } from "@/lib/client-choices/types";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import {
  eventOrderPortalAdditionalReferenceTotal,
  eventOrderPortalLineMoneyLabel,
} from "@/lib/client-portal/event-order-portal-display";
import type { CoupleDocumentView } from "@/lib/event-orders/couple-document";
import { matchChoiceGroupsToSections } from "@/lib/event-orders/document-view";
import {
  coupleVisibleLineNotes,
  coupleVisibleLineUnit,
} from "@/lib/event-orders/share-consistency";
import { formatCurrency } from "@/lib/invoices/constants";
import { DEFAULT_VENUE_BRAND, venueBrandSurfaceStyle } from "@/lib/theme/venue-brand-surface";

type Line = CoupleDocumentView["lines"][number];

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * Couple-facing Event Order document body.
 * Shared by /order/{token} and the venue Event Order → Preview so the preview
 * cannot drift from what the couple receives.
 */
export function EventOrderDocumentView({
  doc,
  mode = "live",
  pending = false,
  saveState = "idle",
  onAnswersChange,
  onApprove,
}: {
  doc: CoupleDocumentView;
  mode?: "live" | "preview";
  pending?: boolean;
  saveState?: "idle" | "saving" | "saved" | "error";
  onAnswersChange?: (answers: ChoicesAnswers) => void;
  onApprove?: (answers: ChoicesAnswers) => void;
}) {
  const isPreview = mode === "preview";
  const choices = doc.choices;
  const [answers, setAnswers] = React.useState<ChoicesAnswers>(choices?.answers ?? {});
  const [limitMessage, setLimitMessage] = React.useState<string | null>(null);
  const brand = doc.brand ?? { ...DEFAULT_VENUE_BRAND, logoUrl: null };
  const brandStyle = venueBrandSurfaceStyle(brand);

  const canPick = Boolean(choices?.editable) && !doc.approved && !doc.updating;
  const definition = choices?.definition ?? null;
  const visibleGroups = definition ? orderedVisibleChoiceGroups(definition, answers) : [];
  const sectionNameById = new Map((definition?.sections ?? []).map((s) => [s.id, s.name]));
  const placement = matchChoiceGroupsToSections(
    visibleGroups.map((g) => ({
      group: g,
      name: g.name,
      sectionName: g.sectionId ? sectionNameById.get(g.sectionId) ?? null : null,
    })),
    doc.sections,
  );
  const validation = definition ? validateChoicesAnswers(definition, answers) : { ok: true as const };
  const choiceExtras = definition && canPick
    ? financialDeltaFromLines(resolveSelectedOptions(definition, answers))
    : 0;
  const additionalTotal = eventOrderPortalAdditionalReferenceTotal(doc.lines);
  const approveBlockedReason = doc.updating
    ? "Your venue is updating this Event Order. You'll get a new link when it's ready."
    : !validation.ok
      ? validation.message ?? "Finish your choices to approve."
      : null;

  function toggle(group: ChoicesDefinitionGroup, optionId: string) {
    if (!definition || !canPick) return;
    const current = answers[group.id]?.optionIds ?? [];
    const selected = current.includes(optionId);
    if (group.selectionMode === "multi" && !selected && isAtSelectionMaximum(group, current.length)) {
      setLimitMessage(selectionMaximumReachedMessage(group));
      return;
    }
    setLimitMessage(null);
    const nextIds = group.selectionMode === "single"
      ? (selected ? [] : [optionId])
      : (selected ? current.filter((id) => id !== optionId) : [...current, optionId]);
    const next = reconcileAnswersForDependencies(definition, {
      ...answers,
      [group.id]: { ...answers[group.id], optionIds: nextIds },
    });
    setAnswers(next);
    if (!isPreview) onAnswersChange?.(next);
  }

  function renderGroup(group: ChoicesDefinitionGroup) {
    if (!definition) return null;
    const options = definition.options
      .filter((o) => o.groupId === group.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const selected = answers[group.id]?.optionIds ?? [];
    const progress = selectionProgressForGroup(group, selected.length);
    return (
      <fieldset
        key={group.id}
        className="space-y-2 rounded-lg border px-4 py-3"
        style={{ borderColor: "var(--venue-primary)", backgroundColor: "var(--venue-card)" }}
        disabled={!canPick}
        data-testid="order-choice-group"
        data-group-name={group.name}
      >
        <legend className="px-1 text-sm font-medium text-heading">{group.name}</legend>
        <p className="text-xs text-muted-foreground" data-testid="order-choice-progress">{progress.label}</p>
        {group.instructions ? <p className="text-xs text-muted-foreground">{group.instructions}</p> : null}
        <div className="space-y-2">
          {options.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <label
                key={opt.id}
                className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${checked ? "border-heading" : "border-border"} ${canPick ? "cursor-pointer" : ""}`}
              >
                <input
                  type={group.selectionMode === "single" ? "radio" : "checkbox"}
                  name={group.id}
                  className="mt-0.5"
                  checked={checked}
                  disabled={!canPick}
                  onChange={() => toggle(group, opt.id)}
                  data-testid={`order-choice-option-${opt.id}`}
                />
                {opt.imageUrl?.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={opt.imageUrl.trim()}
                    alt=""
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-md border border-border/60 bg-muted/30 object-contain"
                  />
                ) : null}
                <span className="flex-1">
                  <span className="font-medium">{opt.label}</span>
                  {opt.description ? <span className="block text-xs text-muted-foreground">{opt.description}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {opt.isIncluded ? "Included" : opt.unitPrice != null ? `+${formatCurrency(opt.unitPrice)}` : "Additional"}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  function renderLines(lines: Line[]) {
    if (lines.length === 0) return null;
    return (
      <ul className="divide-y divide-border rounded-lg border border-border" style={{ backgroundColor: "var(--venue-card)" }}>
        {lines.map((l) => {
          const unit = coupleVisibleLineUnit(l.unit);
          const notes = coupleVisibleLineNotes(l.notes);
          return (
            <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-3" data-testid="order-line">
              <div className="min-w-0">
                <p className="text-sm">{l.description}</p>
                <p className="text-xs text-muted-foreground">×{l.quantity}{unit ? ` ${unit}` : ""}</p>
                {notes ? <p className="mt-1 text-xs text-muted-foreground">{notes}</p> : null}
              </div>
              <p className="shrink-0 text-sm font-medium">{eventOrderPortalLineMoneyLabel(l, formatCurrency)}</p>
            </li>
          );
        })}
      </ul>
    );
  }

  const unsectionedLines = doc.lines.filter((l) => !l.sectionId || !doc.sections.some((s) => s.id === l.sectionId));
  const looseGroups = placement.unmatched.map((p) => p.group);

  return (
    <div
      className="mx-auto min-h-full max-w-2xl px-4 py-12 text-foreground"
      style={brandStyle}
      data-theme-lock="light"
      data-venue-brand="event-order"
      data-order-mode={mode}
      data-testid="order-document"
    >
      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--venue-secondary)" }}>
        Your Event Order
      </p>
      {brand.logoUrl || doc.venueName ? (
        <div className="mt-3 flex items-center gap-3">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={doc.venueName ?? "Venue logo"}
              className="h-14 w-14 shrink-0 rounded-lg bg-white/80 object-contain p-1 shadow-sm"
            />
          ) : null}
          {doc.venueName ? (
            <p className="text-sm font-medium" style={{ color: "var(--venue-secondary)" }}>{doc.venueName}</p>
          ) : null}
        </div>
      ) : null}
      <h1
        className="mt-2 font-heading text-3xl text-foreground"
        style={{ borderBottom: "3px solid var(--venue-primary)", paddingBottom: "0.5rem" }}
      >
        {doc.eventName ?? "Event Order"}
      </h1>
      {formatDate(doc.eventDate) ? (
        <p className="mt-2 text-sm text-muted-foreground">{formatDate(doc.eventDate)}</p>
      ) : null}
      <p className="mt-4 text-sm text-muted-foreground">
        {canPick
          ? "Here is everything planned for your event. Make your choices in each section, then approve. Your picks save as you go."
          : "Here is everything planned for your event."}
        {" "}This is not your invoice or contract.
      </p>

      {doc.approved ? (
        <p className="mt-6 rounded-lg border px-4 py-3 text-sm font-medium" style={{ borderColor: "var(--venue-primary)", backgroundColor: "var(--venue-card)" }} data-testid="order-approved">
          You approved this Event Order{doc.approvedAt ? ` on ${formatDate(doc.approvedAt)}` : ""}. Your venue has been notified.
        </p>
      ) : doc.updating ? (
        <p className="mt-6 rounded-lg border border-border px-4 py-3 text-sm" data-testid="order-updating">
          Your venue is updating this Event Order. You&apos;ll get a new link when it&apos;s ready.
        </p>
      ) : null}

      <div className="mt-8 space-y-8">
        {doc.sections.map((section) => {
          const lines = doc.lines.filter((l) => l.sectionId === section.id);
          const groups = (placement.bySectionId.get(section.id) ?? []).map((p) => p.group);
          if (lines.length === 0 && groups.length === 0) return null;
          return (
            <section key={section.id} className="space-y-3" data-testid="order-section" data-section-name={section.name}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{section.name}</h2>
              {renderLines(lines)}
              {groups.map((g) => renderGroup(g))}
            </section>
          );
        })}
        {unsectionedLines.length > 0 || looseGroups.length > 0 ? (
          <section className="space-y-3" data-testid="order-section" data-section-name="">
            {doc.sections.length > 0 ? (
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Also included</h2>
            ) : null}
            {renderLines(unsectionedLines)}
            {looseGroups.map((g) => renderGroup(g))}
          </section>
        ) : null}
      </div>

      <section className="mt-8 rounded-lg border border-border px-4 py-4" style={{ backgroundColor: "var(--venue-card)" }}>
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Additional items on this Event Order</span>
          <span className="font-medium" data-testid="order-additional-total">{formatCurrency(additionalTotal)}</span>
        </div>
        {canPick ? (
          <div className="mt-1 flex justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Your choices add</span>
            <span className="font-medium" data-testid="order-choice-extras">{formatCurrency(choiceExtras)}</span>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Approving does not charge you. Your venue sends any new charges separately.
        </p>
      </section>

      {!doc.approved ? (
        <div className="mt-6">
          {limitMessage ? <p className="mb-2 text-sm text-destructive" role="alert">{limitMessage}</p> : null}
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={isPreview || pending || Boolean(approveBlockedReason)}
            onClick={() => onApprove?.(answers)}
            data-testid="order-approve"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving…
              </>
            ) : (
              "Approve my Event Order"
            )}
          </Button>
          {approveBlockedReason ? (
            <p className="mt-2 text-center text-xs text-muted-foreground" data-testid="order-approve-hint">{approveBlockedReason}</p>
          ) : null}
          {isPreview ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              The couple sees this button. Preview does not send or approve anything.
            </p>
          ) : canPick ? (
            <p className="mt-2 text-center text-xs text-muted-foreground" data-testid="order-save-state">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Your choices are saved." : saveState === "error" ? "Could not save — try again." : "Your choices save as you go."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
