"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveCommercialBookingPrefsAction } from "@/app/(app)/settings/commercial-booking-actions";
import { CustomPaymentScheduleBuilder } from "@/components/settings/custom-payment-schedule-builder";
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
import type { VenueCommercialBookingPrefs } from "@/lib/booking-journey/venue-prefs";
import { SCHEDULE_PRESETS } from "@/lib/payments/constants";
import {
  defaultCustomScheduleTemplate,
  validateCustomScheduleTemplate,
} from "@/lib/payments/custom-default-schedule";

function RadioOption({
  name,
  checked,
  onChange,
  title,
  description,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 cursor-pointer">
      <input
        type="radio"
        name={name}
        className="mt-1"
        checked={checked}
        onChange={onChange}
      />
      <span>
        <span className="block text-sm font-medium text-heading">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export function CommercialBookingPrefsSection({
  initial,
}: {
  initial: VenueCommercialBookingPrefs;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();

  function save() {
    if (prefs.remainingBalanceMode === "plan" && prefs.defaultSchedulePresetId === "custom") {
      const v = validateCustomScheduleTemplate(prefs.defaultCustomSchedule);
      if (!v.ok) {
        toast.error(v.errors[0] ?? "Fix your Custom payment schedule before saving.");
        return;
      }
    }
    startTransition(async () => {
      const result = await saveCommercialBookingPrefsAction({
        ...prefs,
        // Always persist inert processOrder; never deposit_first.
        processOrder: "agreement_first",
        initialPaymentRequired: prefs.collectInitialPayment,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setPrefs(result.prefs);
      toast.success("Booking preferences saved.");
      router.refresh();
    });
  }

  const remainingMode = prefs.remainingBalanceMode === "plan" ? "plan" : "final";
  const planSelectValue = prefs.defaultSchedulePresetId ?? "deposit_remaining";

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        These defaults guide how you sell and collect payment. They do not decide when a
        relationship becomes Booked — you do that when you&apos;re ready.
      </p>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          How you sell
        </p>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-heading">Agreement</Label>
          <div className="space-y-2">
            <RadioOption
              name="agreement"
              checked={prefs.agreementMethod === "offer"}
              onChange={() => setPrefs((p) => ({ ...p, agreementMethod: "offer" }))}
              title="Proposal"
              description="Let the couple choose"
            />
            <RadioOption
              name="agreement"
              checked={prefs.agreementMethod === "contract"}
              onChange={() => setPrefs((p) => ({ ...p, agreementMethod: "contract" }))}
              title="Contract"
              description="We already know what they're buying"
            />
            <RadioOption
              name="agreement"
              checked={prefs.agreementMethod === "either"}
              onChange={() => setPrefs((p) => ({ ...p, agreementMethod: "either" }))}
              title="Either"
              description="Choose per booking"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Initial payment
        </p>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-heading">Collect an initial payment?</Label>
          <div className="space-y-2">
            <RadioOption
              name="collect-initial"
              checked={prefs.collectInitialPayment}
              onChange={() =>
                setPrefs((p) => ({
                  ...p,
                  collectInitialPayment: true,
                  initialPaymentRequired: true,
                }))
              }
              title="Yes"
              description="Use a default percentage when the package total is known"
            />
            <RadioOption
              name="collect-initial"
              checked={!prefs.collectInitialPayment}
              onChange={() =>
                setPrefs((p) => ({
                  ...p,
                  collectInitialPayment: false,
                  initialPaymentRequired: false,
                }))
              }
              title="No"
              description="No initial payment by default — you can still add one on a booking"
            />
          </div>
        </div>
        {prefs.collectInitialPayment ? (
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="default-deposit-pct">Default initial payment</Label>
            <div className="flex items-center gap-2">
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
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Payment collection
        </p>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-heading">How do you collect payments?</Label>
          <div className="space-y-2">
            <RadioOption
              name="payment-collection"
              checked={prefs.paymentCollection === "online"}
              onChange={() => setPrefs((p) => ({ ...p, paymentCollection: "online" }))}
              title="Online through HTC"
              description="Request payment links through Hello to Cheers"
            />
            <RadioOption
              name="payment-collection"
              checked={prefs.paymentCollection === "external"}
              onChange={() => setPrefs((p) => ({ ...p, paymentCollection: "external" }))}
              title="Outside HTC"
              description="Record payments you collect elsewhere"
            />
            <RadioOption
              name="payment-collection"
              checked={prefs.paymentCollection === "either"}
              onChange={() => setPrefs((p) => ({ ...p, paymentCollection: "either" }))}
              title="Either"
              description="Choose online or outside per booking"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Remaining balance
        </p>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-heading">
            How do you normally collect the remaining balance?
          </Label>
          <div className="space-y-2">
            <RadioOption
              name="remaining-balance"
              checked={remainingMode === "final"}
              onChange={() =>
                setPrefs((p) => ({
                  ...p,
                  remainingBalanceMode: "final",
                  defaultSchedulePresetId: null,
                  defaultCustomSchedule: null,
                }))
              }
              title="One final payment"
              description="Deposit (if any) plus one remaining balance"
            />
            <RadioOption
              name="remaining-balance"
              checked={remainingMode === "plan"}
              onChange={() => setPrefs((p) => ({ ...p, remainingBalanceMode: "plan" }))}
              title="Payment plan"
              description="Use a default installment schedule"
            />
          </div>
        </div>
        {remainingMode === "plan" ? (
          <div className="space-y-3">
            <div className="space-y-2 max-w-sm">
              <Label>Default payment plan</Label>
              <Select
                value={planSelectValue}
                onValueChange={(v) =>
                  setPrefs((p) => {
                    if (v === "deposit_remaining") {
                      return {
                        ...p,
                        defaultSchedulePresetId: null,
                        defaultCustomSchedule: null,
                      };
                    }
                    if (v === "custom") {
                      return {
                        ...p,
                        defaultSchedulePresetId: "custom",
                        defaultCustomSchedule:
                          p.defaultCustomSchedule ?? defaultCustomScheduleTemplate("percentage"),
                      };
                    }
                    return {
                      ...p,
                      defaultSchedulePresetId: v,
                      defaultCustomSchedule: null,
                    };
                  })
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
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose a preset, or Custom to create your own schedule.
              </p>
            </div>
            {planSelectValue === "custom" ? (
              <CustomPaymentScheduleBuilder
                value={prefs.defaultCustomSchedule}
                onChange={(defaultCustomSchedule) =>
                  setPrefs((p) => ({
                    ...p,
                    defaultSchedulePresetId: "custom",
                    defaultCustomSchedule,
                  }))
                }
              />
            ) : null}
          </div>
        ) : null}
      </section>

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
