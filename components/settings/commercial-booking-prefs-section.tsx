"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveCommercialBookingPrefsAction } from "@/app/(app)/settings/commercial-booking-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { VenueCommercialBookingPrefs } from "@/lib/booking-journey/venue-prefs";
import { SCHEDULE_PRESETS } from "@/lib/payments/constants";

export function CommercialBookingPrefsSection({
  initial,
}: {
  initial: VenueCommercialBookingPrefs;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveCommercialBookingPrefsAction(prefs);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setPrefs(result.prefs);
      toast.success("Booking preferences saved.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        These defaults guide how Hello to Cheers moves a lead from package selection to Booked.
        You can still override deposit amounts and schedules on each booking.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Agreement method</Label>
          <Select
            value={prefs.agreementMethod}
            onValueChange={(v) =>
              setPrefs((p) => ({
                ...p,
                agreementMethod: v as VenueCommercialBookingPrefs["agreementMethod"],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="either">Offer or contract</SelectItem>
              <SelectItem value="offer">Offer / proposal</SelectItem>
              <SelectItem value="contract">Contract only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Process order</Label>
          <Select
            value={prefs.processOrder}
            onValueChange={(v) =>
              setPrefs((p) => ({
                ...p,
                processOrder: v as VenueCommercialBookingPrefs["processOrder"],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agreement_first">Agreement first, then deposit</SelectItem>
              <SelectItem value="deposit_first">Deposit first, then agreement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Payment collection</Label>
          <Select
            value={prefs.paymentCollection}
            onValueChange={(v) =>
              setPrefs((p) => ({
                ...p,
                paymentCollection: v as VenueCommercialBookingPrefs["paymentCollection"],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="either">Online or external</SelectItem>
              <SelectItem value="online">Online through HTC</SelectItem>
              <SelectItem value="external">External / manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Remaining balance</Label>
          <Select
            value={prefs.remainingBalanceMode}
            onValueChange={(v) =>
              setPrefs((p) => ({
                ...p,
                remainingBalanceMode: v as VenueCommercialBookingPrefs["remainingBalanceMode"],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="varies">Varies by booking</SelectItem>
              <SelectItem value="final">One final payment</SelectItem>
              <SelectItem value="plan">Payment plan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="default-deposit-pct">Default deposit %</Label>
          <Input
            id="default-deposit-pct"
            type="number"
            min={0}
            max={100}
            step={1}
            value={prefs.defaultDepositPercent}
            onChange={(e) =>
              setPrefs((p) => ({
                ...p,
                defaultDepositPercent: Number(e.target.value) || 0,
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Default payment plan preset</Label>
          <Select
            value={prefs.defaultSchedulePresetId ?? "deposit_remaining"}
            onValueChange={(v) =>
              setPrefs((p) => ({
                ...p,
                defaultSchedulePresetId: v === "deposit_remaining" ? null : v,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deposit_remaining">Deposit + final balance</SelectItem>
              {SCHEDULE_PRESETS.filter((p) => p.items.length > 0).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <div>
          <p className="text-sm font-medium text-heading">Require initial payment to book</p>
          <p className="text-xs text-muted-foreground">
            When off, a signed/accepted agreement alone marks them Booked.
          </p>
        </div>
        <Switch
          checked={prefs.initialPaymentRequired}
          onCheckedChange={(checked) =>
            setPrefs((p) => ({ ...p, initialPaymentRequired: checked }))
          }
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save booking preferences"
          )}
        </Button>
      </div>
    </div>
  );
}
