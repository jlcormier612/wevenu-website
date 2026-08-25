"use client";

/**
 * Shared destructive-action confirmation. Generalizes the existing
 * EventOrderZeroTotalConfirmDialog pattern (components/event-orders/
 * zero-total-confirm.tsx) rather than inventing a new one: same hand-rolled
 * centered modal, same backdrop-click/Escape-to-cancel, same Cancel-is-
 * default-focused safety property — just parameterized for "confirm this
 * named destructive thing" instead of one specific warning.
 *
 * Despite the name/location (its first callers were all Library asset
 * deletes), the props are deliberately generic — `title`/`description`
 * overrides and a configurable `actionVerb` let any destructive action reuse
 * it (e.g. removing a team member) rather than hand-rolling a near-identical
 * modal per surface.
 *
 * Deletion-safety standard (2026-08-21): destructive action -> confirmation
 * dialog -> explicit confirmation -> action. The destructive action is never
 * the default/focused control, and the message always names the item and
 * states the real consequence — never a bare "Are you sure?".
 */

import * as React from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LibraryDeleteConfirmDialog({
  open,
  itemName,
  /** e.g. "template", "questionnaire", "brochure" — used in the confirm button and body copy. */
  itemLabel,
  /** Defaults to true (hard delete). Set false only when the action is actually recoverable (soft-delete/archive-like) — never claim "cannot be undone" for something that isn't. */
  permanent = true,
  /** Extra domain-specific consequence line, e.g. "Events already created from it are unaffected." */
  consequenceNote,
  /** Full override for the title (default: `${actionVerb} "{itemName}"?`). */
  title,
  /** Full override for the body copy — use when the permanent/consequenceNote template doesn't fit (e.g. a non-delete removal with its own precise wording). */
  description,
  /** Defaults to "Delete". Pass e.g. "Remove" for actions that aren't literally deleting a record. */
  actionVerb = "Delete",
  /** Defaults to "Deleting…" (or "{actionVerb}ing…" if actionVerb is customized without this). */
  pendingLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  itemName: string;
  itemLabel: string;
  permanent?: boolean;
  consequenceNote?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actionVerb?: string;
  pendingLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0 bg-black/40"
        onClick={() => { if (!pending) onCancel(); }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="library-delete-confirm-title"
        aria-describedby="library-delete-confirm-desc"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="library-delete-confirm-title" className="text-base font-semibold text-heading">
          {title ?? <>{actionVerb} &ldquo;{itemName}&rdquo;?</>}
        </h2>
        <p id="library-delete-confirm-desc" className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {description ?? (
            <>
              {permanent
                ? `This will permanently remove this ${itemLabel}. This action cannot be undone.`
                : `This removes this ${itemLabel} from your active list. It can be restored later.`}
              {consequenceNote ? ` ${consequenceNote}` : ""}
            </>
          )}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" autoFocus disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending
              ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{pendingLabel ?? (actionVerb === "Delete" ? "Deleting…" : `${actionVerb}ing…`)}</>
              : `${actionVerb} ${itemLabel}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
