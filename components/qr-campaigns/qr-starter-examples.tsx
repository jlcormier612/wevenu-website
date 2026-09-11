"use client";

import * as React from "react";
import { QrCode } from "lucide-react";
import { toast } from "sonner";

import { addQrStarterAgainAction, createQrFromStarterAction } from "@/app/(app)/library/qr-campaigns/actions";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { QR_STARTER_MASTERS, type QrStarterMasterKey } from "@/lib/qr-campaigns/starters";

export function QrStarterExamples({
  existingMasterKeys,
}: {
  existingMasterKeys: string[];
}) {
  const [pending, setPending] = React.useState<string | null>(null);
  const existing = new Set(existingMasterKeys);

  async function useStarter(key: QrStarterMasterKey) {
    setPending(key);
    const result = existing.has(key)
      ? await addQrStarterAgainAction(key)
      : await createQrFromStarterAction(key);
    setPending(null);
    if (!result.ok) {
      toast.error(result.message ?? "Could not create QR campaign.");
      return;
    }
    toast.success(
      existing.has(key)
        ? "Starter added again. Your new code is ready below."
        : "QR campaign created. Your new code is ready below.",
    );
    window.location.reload();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-heading">Hello to Cheers starters</p>
          <p className="text-xs text-muted-foreground">
            Persistent starting points — available even when you already have campaigns.
          </p>
        </div>
      </div>
      {QR_STARTER_MASTERS.map((starter) => {
        const already = existing.has(starter.key);
        return (
          <LibraryAssetCard
            key={starter.key}
            title={starter.name}
            description={starter.description}
            meta={starter.destinationLabel}
            isStarter
            primaryActions={[{
              id: `use-${starter.key}`,
              label: pending === starter.key
                ? "Creating…"
                : already
                  ? "Add again"
                  : "Use this starter",
              onClick: () => useStarter(starter.key),
              emphasis: "use",
              disabled: pending !== null,
            }]}
          />
        );
      })}
    </section>
  );
}
