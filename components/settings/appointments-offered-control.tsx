"use client";

/**
 * Same appointment Yes/No + types as White Glove / Self-Setup intake.
 * Persists to venue_onboarding_intake — does not configure calendar booking.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateAppointmentOfferSignalAction } from "@/app/(app)/settings/appointment-offer-actions";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  APPOINTMENT_TYPE_OPTIONS,
  type AppointmentTypeKey,
} from "@/lib/onboarding/types";

export function AppointmentsOfferedControl({
  initialOffers,
  initialTypeKeys = [],
  initialOther = "",
  canEdit = true,
}: {
  initialOffers: boolean | null;
  initialTypeKeys?: AppointmentTypeKey[];
  initialOther?: string | null;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [offers, setOffers] = React.useState<boolean | null>(initialOffers);
  const [typeKeys, setTypeKeys] = React.useState<AppointmentTypeKey[]>(initialTypeKeys);
  const [other, setOther] = React.useState(initialOther ?? "");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setOffers(initialOffers);
    setTypeKeys(initialTypeKeys);
    setOther(initialOther ?? "");
  }, [initialOffers, initialTypeKeys, initialOther]);

  function persist(next: {
    offers: boolean | null;
    typeKeys: AppointmentTypeKey[];
    other: string;
  }) {
    startTransition(async () => {
      const result = await updateAppointmentOfferSignalAction({
        offersAppointmentsOtherThanTours: next.offers,
        appointmentTypeKeys: next.typeKeys,
        appointmentTypesOther: next.other,
      });
      if (result.ok) {
        toast.success("Appointment preferences saved.");
        router.refresh();
      } else {
        setOffers(initialOffers);
        setTypeKeys(initialTypeKeys);
        setOther(initialOther ?? "");
        toast.error(result.message ?? "Could not save appointment preferences.");
      }
    });
  }

  function onOffersChange(next: boolean) {
    const typeKeysNext = next ? typeKeys : [];
    const otherNext = next ? other : "";
    setOffers(next);
    if (!next) {
      setTypeKeys([]);
      setOther("");
    }
    persist({ offers: next, typeKeys: typeKeysNext, other: otherNext });
  }

  function toggleType(key: AppointmentTypeKey) {
    const nextKeys = typeKeys.includes(key)
      ? typeKeys.filter((k) => k !== key)
      : [...typeKeys, key];
    setTypeKeys(nextKeys);
    if (!nextKeys.includes("other")) setOther("");
    persist({
      offers: true,
      typeKeys: nextKeys,
      other: nextKeys.includes("other") ? other : "",
    });
  }

  function onOtherBlur() {
    if (offers !== true || !typeKeys.includes("other")) return;
    persist({ offers: true, typeKeys, other });
  }

  return (
    <div
      className="space-y-3 rounded-md border border-border p-3"
      data-testid="appointments-offered-settings"
    >
      <div className="space-y-1">
        <Label className="text-sm font-medium">Do you offer appointments other than tours?</Label>
        <p className="text-xs text-muted-foreground">
          For example, consultations, planning meetings, menu tastings, or final walkthroughs.
        </p>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="settings-appointments-other-than-tours"
            checked={offers === true}
            disabled={!canEdit || pending}
            onChange={() => onOffersChange(true)}
          />
          Yes
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="settings-appointments-other-than-tours"
            checked={offers === false}
            disabled={!canEdit || pending}
            onChange={() => onOffersChange(false)}
          />
          No
        </label>
      </div>
      {offers === true ? (
        <div className="space-y-3 border-t border-border/70 pt-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">What types of appointments do you offer?</p>
            <p className="text-xs text-muted-foreground">Select all that apply.</p>
          </div>
          {APPOINTMENT_TYPE_OPTIONS.map((opt) => (
            <label key={opt.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={typeKeys.includes(opt.key)}
                disabled={!canEdit || pending}
                onChange={() => toggleType(opt.key)}
                data-testid={`settings-appointment-type-${opt.key}`}
              />
              {opt.label}
            </label>
          ))}
          {typeKeys.includes("other") ? (
            <div className="space-y-2">
              <Label htmlFor="settings-appointment-types-other">
                Describe your other appointments
              </Label>
              <Textarea
                id="settings-appointment-types-other"
                value={other}
                disabled={!canEdit || pending}
                onChange={(e) => setOther(e.target.value)}
                onBlur={onOtherBlur}
                rows={2}
                data-testid="settings-appointment-types-other"
              />
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            This does not turn on booking or create calendar availability by itself. Use Scheduled
            appointment types below when you are ready to configure what staff can place on the
            Calendar.
          </p>
        </div>
      ) : null}
    </div>
  );
}
