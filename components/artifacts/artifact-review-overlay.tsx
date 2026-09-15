"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Full-viewport review chrome for customer-facing artifacts.
 * Portaled to document.body so Sheets/drawers cannot cover it.
 * Opening this must not commit, send, accept, or sign.
 */
export function ArtifactReviewOverlay({
  open,
  eyebrow,
  title,
  onBack,
  primary,
  footer,
  children,
}: {
  open: boolean;
  eyebrow: string;
  title: string;
  onBack: () => void;
  primary?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const ui = (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[var(--warm-gray,#f8f7f4)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="artifact-review-title"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 id="artifact-review-title" className="truncate font-heading text-lg text-heading">
            {title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            Back to edit
          </Button>
          {primary}
        </div>
      </header>
      <div className={cn("min-h-0 flex-1 overflow-x-hidden overflow-y-auto")}>{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6">
          {footer}
        </div>
      ) : null}
    </div>
  );

  if (!mounted) return ui;
  return createPortal(ui, document.body);
}
