"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  saveBrandAction,
  saveBusinessHoursAction,
  saveOwnerAction,
  saveVenueInfoAction,
  saveVenueProfileAction,
  updateLogoAction,
} from "@/app/(app)/settings/actions";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  BrandStep,
  BusinessHoursStep,
  OwnerStep,
  VenueDetailsStep,
  VenueInfoStep,
} from "@/components/setup/setup-steps";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SaveSectionResult } from "@/lib/venue/service";
import type {
  BusinessHourInput,
  VenueSetupErrors,
  VenueSetupInput,
} from "@/lib/venue/types";

// ---- Section wrapper --------------------------------------------------------

/**
 * A settings card that owns its own pending state via React 19 transitions.
 * Calls `onSave()` (async) when the user clicks "Save changes", and shows
 * a spinner while the server action is in flight.
 */
function SettingsSection({
  title,
  description,
  onSave,
  children,
}: {
  title: string;
  description?: string;
  onSave: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter className="justify-end">
        <Button
          type="button"
          disabled={pending}
          onClick={() => startTransition(onSave)}
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---- Main component ---------------------------------------------------------

export function VenueSettings({
  initial,
  venueId,
}: {
  initial: VenueSetupInput;
  venueId: string;
}) {
  const [input, setInput] = React.useState<VenueSetupInput>(initial);
  const [errors, setErrors] = React.useState<VenueSetupErrors>({});

  const set = React.useCallback(
    <K extends keyof VenueSetupInput>(key: K, value: VenueSetupInput[K]) => {
      setInput((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    },
    [],
  );

  const setHour = React.useCallback(
    (dayOfWeek: number, patch: Partial<BusinessHourInput>) => {
      setInput((prev) => ({
        ...prev,
        businessHours: prev.businessHours.map((h) =>
          h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h,
        ),
      }));
      setErrors((prev) => {
        const key = `hours.${dayOfWeek}`;
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const stepProps = { input, errors, set, setHour };

  /** Dispatch a server action, surface errors or toast on success. */
  async function save(
    action: (inp: VenueSetupInput) => Promise<SaveSectionResult>,
  ): Promise<void> {
    const result = await action(input);
    if (result.ok) {
      toast.success("Saved");
      return;
    }
    if (result.errors && Object.keys(result.errors).length > 0) {
      setErrors((prev) => ({ ...prev, ...result.errors }));
    }
    toast.error(result.message ?? "Please fix the highlighted fields.");
  }

  return (
    <div className="space-y-6">
      {/* 1 — Venue information (name, business name, contact, address) */}
      <SettingsSection
        title="Venue information"
        description="Name, business name, contact details, and address."
        onSave={() => save(saveVenueInfoAction)}
      >
        <VenueInfoStep {...stepProps} />
      </SettingsSection>

      {/* 2 — Venue profile (type, capacity, timezone) */}
      <SettingsSection
        title="Venue profile"
        description="Type, capacity, and the time zone your venue runs on."
        onSave={() => save(saveVenueProfileAction)}
      >
        <VenueDetailsStep {...stepProps} />
      </SettingsSection>

      {/* 3 — Business hours */}
      <SettingsSection
        title="Business hours"
        description="When your venue is open for tours and events."
        onSave={() => save(saveBusinessHoursAction)}
      >
        <BusinessHoursStep {...stepProps} />
      </SettingsSection>

      {/* 4a — Logo upload (functional, uses Supabase Storage) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Venue Logo</CardTitle>
          <CardDescription>
            Shown in your workspace sidebar, on day-of sheets, and in contract headers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUpload
            currentUrl={input.logoUrl || null}
            bucket="uploads"
            path={`${venueId}/logo`}
            label="Logo"
            hint="Square or horizontal format. PNG, SVG or JPG, up to 5 MB."
            onUpload={async (url) => {
              set("logoUrl", url);
              await updateLogoAction(url);
              toast.success("Logo updated.");
            }}
            onRemove={async () => {
              set("logoUrl", "");
              await updateLogoAction(null);
              toast.success("Logo removed.");
            }}
          />
        </CardContent>
      </Card>

      {/* 4b — Brand settings (primary & secondary colors) */}
      <SettingsSection
        title="Brand colors"
        description="Primary and secondary brand colors displayed throughout your workspace."
        onSave={() => save(saveBrandAction)}
      >
        <BrandStep {...stepProps} />
      </SettingsSection>

      {/* 5 — Owner profile and general settings */}
      <SettingsSection
        title="Owner & general settings"
        description="Owner profile, currency, and week configuration."
        onSave={() => save(saveOwnerAction)}
      >
        <OwnerStep {...stepProps} />
      </SettingsSection>
    </div>
  );
}
