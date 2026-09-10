"use client";

import * as React from "react";
import { toast } from "sonner";

import { setRequiredVendorCategoriesAction } from "@/app/(app)/vendors/actions";
import { Button } from "@/components/ui/button";
import { VENDOR_CATEGORIES, vendorCategoryLabel } from "@/lib/vendors/constants";

/**
 * Progressive disclosure: optional venue process for required categories
 * (e.g. "couples must book a photographer") without forcing a wall of config.
 */
export function RequiredVendorCategoriesPanel({
  initialCategories,
}: {
  initialCategories: string[];
}) {
  const [open, setOpen] = React.useState(initialCategories.length > 0);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(initialCategories));
  const [pending, startTransition] = React.useTransition();

  function toggle(category: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await setRequiredVendorCategoriesAction([...selected]);
      if (result.ok) toast.success("Required categories saved.");
      else toast.error(result.message ?? "Could not save.");
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-foreground">Required categories</p>
          <p className="text-xs text-muted-foreground">
            Optional — when your process requires a type of vendor (not one named business).
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {VENDOR_CATEGORIES.filter((c) => c.value !== "other").map((c) => {
              const active = selected.has(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggle(c.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {vendorCategoryLabel(c.value)}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save categories"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
