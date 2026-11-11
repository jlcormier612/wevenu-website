"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { TourProtectionRequestRow } from "@/lib/tours/protection";

export function PaidUnbookedProtectionList({
  requests,
  canRefund,
}: {
  requests: TourProtectionRequestRow[];
  canRefund: boolean;
}) {
  const router = useRouter();
  const [refunding, setRefunding] = React.useState<string | null>(null);
  if (requests.length === 0) return null;

  async function handleRefund(id: string) {
    setRefunding(id);
    try {
      const { refundTourProtectionFeeAction } = await import("@/app/(app)/settings/tour-actions");
      const result = await refundTourProtectionFeeAction(id);
      if (result.ok) {
        toast.success("Tour fee refunded.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not refund this tour fee.");
      }
    } catch {
      toast.error("Could not refund this tour fee.");
    } finally {
      setRefunding(null);
    }
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const when = new Date(req.slot_start).toLocaleString("en-US", {
          weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        });
        return (
          <div key={req.id} className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-3 space-y-2">
            <p className="text-sm font-medium text-heading">{req.contact_name}</p>
            <p className="text-xs text-muted-foreground">
              Payment or card-on-file succeeded, but {when} was no longer available. No tour appointment was created.
            </p>
            <p className="text-xs text-muted-foreground">{req.contact_email}{req.contact_phone ? ` · ${req.contact_phone}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" render={<Link href={`/leads/${req.lead_id}`} />}>
                Open lead
              </Button>
              {canRefund && req.mode === "fee" && req.stripe_payment_intent_id && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={refunding === req.id}
                  onClick={() => void handleRefund(req.id)}
                >
                  {refunding === req.id ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Refunding…</> : "Refund tour fee"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
