"use client";

/**
 * Explains Hello to Cheers starter ownership and offers a safe Customize path.
 * Starters in the Library are venue-provisioned rows tagged with source_master_key —
 * Customize duplicates into an independent venue-owned template (no master key).
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { LIBRARY_LABELS } from "@/components/library/labels";
import { Button } from "@/components/ui/button";

export function StarterOwnershipBanner({
  templateName,
  onCustomize,
  customizeHref,
  itemNoun = "activities",
}: {
  templateName: string;
  /** Called to create a venue-owned copy; should return the new template id on success. */
  onCustomize: () => Promise<{ ok: true; templateId: string } | { ok: false; message?: string }>;
  /** Path prefix for navigation after customize, e.g. `/library/timeline-templates`. */
  customizeHref: (templateId: string) => string;
  itemNoun?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function customize() {
    startTransition(async () => {
      const result = await onCustomize();
      if (result.ok) {
        toast.success("Created your venue’s copy. The original starter is unchanged.");
        router.push(customizeHref(result.templateId));
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not create a copy.");
      }
    });
  }

  return (
    <div
      className="rounded-md border border-border bg-muted/30 px-3 py-3 space-y-2"
      data-testid="starter-ownership-banner"
    >
      <p className="text-sm font-medium text-heading">Hello to Cheers starter</p>
      <p className="text-xs text-muted-foreground">
        &ldquo;{templateName}&rdquo; is a reusable starting point for your venue. Editing its{" "}
        {itemNoun} changes this starter row. To keep the starter intact and build your own version,
        customize it — that creates a separate venue-owned template you can rename and edit freely.
        The original starter stays available in your Library.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          data-testid="starter-customize"
          onClick={customize}
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Creating copy…
            </>
          ) : (
            LIBRARY_LABELS.customize
          )}
        </Button>
      </div>
    </div>
  );
}
