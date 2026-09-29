"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { LIBRARY_LABELS } from "@/components/library/labels";
import { cn } from "@/lib/utils";

export type LibrarySaveStatusValue =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "error";

/**
 * Autosave status for Library editors.
 * Default: durable "saved" — does not fade back to blank idle (Product Lock /
 * Templates methodology). Pass resetMs > 0 only for surfaces that intentionally
 * blink "Saved just now".
 */
export function useLibrarySaveStatus(resetMs = 0) {
  const [status, setStatus] = React.useState<LibrarySaveStatusValue>("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  React.useEffect(() => () => clearTimer(), [clearTimer]);

  const markDirty = React.useCallback(() => {
    clearTimer();
    setStatus("dirty");
  }, [clearTimer]);

  const markSaving = React.useCallback(() => {
    clearTimer();
    setStatus("saving");
  }, [clearTimer]);

  const markSaved = React.useCallback(() => {
    clearTimer();
    setStatus("saved");
    if (resetMs > 0) {
      timer.current = setTimeout(() => setStatus("idle"), resetMs);
    }
  }, [clearTimer, resetMs]);

  const markError = React.useCallback(() => {
    clearTimer();
    setStatus("error");
  }, [clearTimer]);

  const markIdle = React.useCallback(() => {
    clearTimer();
    setStatus("idle");
  }, [clearTimer]);

  return { status, markDirty, markSaving, markSaved, markError, markIdle, setStatus };
}

export function LibrarySaveStatus({
  status,
  className,
  model = "autosave",
}: {
  status: LibrarySaveStatusValue;
  className?: string;
  /** autosave shows Saving / All changes saved; explicit also shows Unsaved changes */
  model?: "autosave" | "explicit";
}) {
  if (status === "idle") return null;

  let content: React.ReactNode = null;
  if (status === "saving") {
    content = (
      <>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {LIBRARY_LABELS.saving}
      </>
    );
  } else if (status === "saved") {
    content = (
      <>
        <Check className="h-3.5 w-3.5" />
        {model === "explicit" ? LIBRARY_LABELS.saved : LIBRARY_LABELS.allChangesSaved}
      </>
    );
  } else if (status === "error") {
    content = <span className="text-destructive">{LIBRARY_LABELS.unableToSave}</span>;
  } else if (status === "dirty" && model === "explicit") {
    content = <span>Unsaved changes</span>;
  } else if (status === "dirty" && model === "autosave") {
    content = <span>{LIBRARY_LABELS.saving}</span>;
  }

  if (!content) return null;

  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        status === "error" && "text-destructive",
        status === "saved" && "text-foreground",
        className,
      )}
      aria-live="polite"
      data-testid="library-save-status"
      data-status={status}
    >
      {content}
    </p>
  );
}

/** Shared teaching line for autosave Template / Library editors. */
export function LibraryAutosaveHint({ className }: { className?: string }) {
  return (
    <p
      className={cn("text-xs text-muted-foreground", className)}
      data-testid="library-autosave-hint"
    >
      {LIBRARY_LABELS.autosaveTeaching}
    </p>
  );
}
