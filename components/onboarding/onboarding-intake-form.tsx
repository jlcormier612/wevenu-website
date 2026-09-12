"use client";

/**
 * Shared guided intake form — Self-Setup and White Glove.
 * Copy and choices are exactly as specified in the product definition.
 */
import * as React from "react";

import {
  BRING_BUSINESS_OPTIONS,
  INQUIRY_SOURCE_OPTIONS,
  type BringBusinessChoice,
  type InquirySourceKey,
  type OnboardingIntakeInput,
  type SpaceMode,
  type TastingAppointmentChoice,
} from "@/lib/onboarding/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type IntakePrefill = Partial<OnboardingIntakeInput> & {
  venueName?: string;
  contactEmail?: string;
  primaryContactName?: string;
};

type Props = {
  mode: "self_setup" | "white_glove";
  prefill: IntakePrefill;
  /** White Glove only — optional upload UI rendered by parent between sections. */
  materialsSlot?: React.ReactNode;
  submitLabel: string;
  onSubmit: (intake: OnboardingIntakeInput) => Promise<void>;
};

export function OnboardingIntakeForm({
  mode,
  prefill,
  materialsSlot,
  submitLabel,
  onSubmit,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [venueName, setVenueName] = React.useState(prefill.venueName ?? "");
  const [addressLine1, setAddressLine1] = React.useState(prefill.addressLine1 ?? "");
  const [city, setCity] = React.useState(prefill.city ?? "");
  const [stateRegion, setStateRegion] = React.useState(prefill.stateRegion ?? "");
  const [postalCode, setPostalCode] = React.useState(prefill.postalCode ?? "");
  const [primaryContactName, setPrimaryContactName] = React.useState(
    prefill.primaryContactName ?? "",
  );
  const [contactEmail, setContactEmail] = React.useState(prefill.contactEmail ?? "");
  const [contactPhone, setContactPhone] = React.useState(prefill.contactPhone ?? "");
  const [website, setWebsite] = React.useState(prefill.website ?? "");

  const [spaceMode, setSpaceMode] = React.useState<SpaceMode>(prefill.spaceMode ?? "one");
  const [spaceName, setSpaceName] = React.useState(
    prefill.spaces?.[0]?.name ?? "Main Space",
  );
  const [spaceCapacity, setSpaceCapacity] = React.useState(
    prefill.spaces?.[0]?.maxCapacity != null
      ? String(prefill.spaces[0].maxCapacity)
      : "",
  );
  const [extraSpaces, setExtraSpaces] = React.useState<
    Array<{ name: string; capacity: string }>
  >(
    (prefill.spaces ?? []).slice(1).map((s) => ({
      name: s.name,
      capacity: s.maxCapacity != null ? String(s.maxCapacity) : "",
    })),
  );

  const [offersTours, setOffersTours] = React.useState<boolean | null>(
    typeof prefill.offersTours === "boolean" ? prefill.offersTours : null,
  );
  const [tastingChoice, setTastingChoice] = React.useState<TastingAppointmentChoice | null>(
    prefill.tastingAppointmentChoice ?? null,
  );
  const [inquirySources, setInquirySources] = React.useState<InquirySourceKey[]>(
    prefill.inquirySources ?? [],
  );
  const [inquiryOther, setInquiryOther] = React.useState(prefill.inquirySourcesOther ?? "");
  const [bringBusiness, setBringBusiness] = React.useState<BringBusinessChoice | null>(
    prefill.bringBusinessChoice ?? null,
  );

  function toggleSource(key: InquirySourceKey) {
    setInquirySources((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!venueName.trim()) {
      setError("Venue name is required.");
      return;
    }
    if (offersTours === null) {
      setError("Please tell us whether you offer tours.");
      return;
    }
    if (!tastingChoice) {
      setError("Please tell us about tastings or other appointments.");
      return;
    }
    if (inquirySources.length === 0) {
      setError("Select at least one inquiry source.");
      return;
    }
    if (!bringBusiness) {
      setError("Please tell us whether you are bringing information from another system.");
      return;
    }

    const spaces =
      spaceMode === "one"
        ? [
            {
              name: spaceName.trim() || "Main Space",
              maxCapacity: spaceCapacity ? Number(spaceCapacity) : null,
            },
          ]
        : [
            {
              name: spaceName.trim() || "Main Space",
              maxCapacity: spaceCapacity ? Number(spaceCapacity) : null,
            },
            ...extraSpaces.map((s) => ({
              name: s.name.trim() || "Space",
              maxCapacity: s.capacity ? Number(s.capacity) : null,
            })),
          ];

    const payload: OnboardingIntakeInput = {
      venueName: venueName.trim(),
      addressLine1: addressLine1.trim() || null,
      city: city.trim() || null,
      stateRegion: stateRegion.trim() || null,
      postalCode: postalCode.trim() || null,
      primaryContactName: primaryContactName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      website: website.trim() || null,
      spaceMode,
      spaces,
      offersTours,
      tastingAppointmentChoice: tastingChoice,
      inquirySources,
      inquirySourcesOther: inquiryOther.trim() || null,
      bringBusinessChoice: bringBusiness,
      acceptStarters: bringBusiness === "starting_fresh",
    };

    setBusy(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-10 pb-16">
      {mode === "white_glove" ? (
        <header className="space-y-3">
          <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground">
            Let&apos;s get your venue ready
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You&apos;ve chosen White Glove Setup. We&apos;ll build your Hello to Cheers
            workspace using the information and materials you provide.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You don&apos;t need to configure everything yourself.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We&apos;ll let you know if we need you to make a decision we can&apos;t make for
            you.
          </p>
        </header>
      ) : (
        <header className="space-y-3">
          <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground">
            Tell us about your venue
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We&apos;ll use what we already know and only ask for what we need to get you
            started.
          </p>
        </header>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Venue basics</h2>
        <Field label="Venue name" value={venueName} onChange={setVenueName} required />
        <Field label="Address" value={addressLine1} onChange={setAddressLine1} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="City" value={city} onChange={setCity} />
          <Field label="State" value={stateRegion} onChange={setStateRegion} />
          <Field label="Postal code" value={postalCode} onChange={setPostalCode} />
        </div>
        <Field
          label="Primary owner/contact"
          value={primaryContactName}
          onChange={setPrimaryContactName}
        />
        <Field label="Contact email" value={contactEmail} onChange={setContactEmail} type="email" />
        <Field label="Contact phone" value={contactPhone} onChange={setContactPhone} />
        {mode === "white_glove" ? (
          <Field label="Website" value={website} onChange={setWebsite} />
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">How does your venue work?</h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ll use this information to set up Hello to Cheers around the way your
          venue actually operates.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-medium">Event spaces</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="spaceMode"
              checked={spaceMode === "one"}
              onChange={() => setSpaceMode("one")}
            />
            One event space
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="spaceMode"
              checked={spaceMode === "multiple"}
              onChange={() => setSpaceMode("multiple")}
            />
            Multiple event spaces
          </label>
        </div>

        <Field label="Space name" value={spaceName} onChange={setSpaceName} />
        <Field
          label="Maximum guest capacity"
          value={spaceCapacity}
          onChange={setSpaceCapacity}
          type="number"
        />

        {spaceMode === "multiple" ? (
          <div className="space-y-3">
            {extraSpaces.map((s, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <Field
                  label={`Space ${i + 2} name`}
                  value={s.name}
                  onChange={(v) =>
                    setExtraSpaces((prev) =>
                      prev.map((row, idx) => (idx === i ? { ...row, name: v } : row)),
                    )
                  }
                />
                <Field
                  label="Capacity"
                  value={s.capacity}
                  onChange={(v) =>
                    setExtraSpaces((prev) =>
                      prev.map((row, idx) => (idx === i ? { ...row, capacity: v } : row)),
                    )
                  }
                  type="number"
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExtraSpaces((prev) => [...prev, { name: "", capacity: "" }])}
            >
              Add another space
            </Button>
          </div>
        ) : null}

        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium">Do you offer tours?</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="tours"
              checked={offersTours === true}
              onChange={() => setOffersTours(true)}
            />
            Yes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="tours"
              checked={offersTours === false}
              onChange={() => setOffersTours(false)}
            />
            No
          </label>
          {offersTours === true ? (
            <p className="text-xs text-muted-foreground">
              You can refine tour availability in Calendar &amp; Availability after setup.
            </p>
          ) : null}
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium">Do you offer tastings or other appointments?</p>
          {(
            [
              ["tastings", "Tastings"],
              ["other_appointments", "Other appointments"],
              ["both", "Both"],
              ["neither", "Neither"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="tastings"
                checked={tastingChoice === value}
                onChange={() => setTastingChoice(value)}
              />
              {label}
            </label>
          ))}
          {tastingChoice && tastingChoice !== "neither" ? (
            <p className="text-xs text-muted-foreground">
              Scheduling details can be refined in your calendar settings when you&apos;re
              ready.
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">How do inquiries usually come to you?</h2>
        <p className="text-sm text-muted-foreground">Select all that apply.</p>
        {INQUIRY_SOURCE_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inquirySources.includes(opt.key)}
              onChange={() => toggleSource(opt.key)}
            />
            {opt.label}
          </label>
        ))}
        {inquirySources.includes("other") ? (
          <div className="space-y-2">
            <Label>Where else do inquiries come from?</Label>
            <Textarea
              value={inquiryOther}
              onChange={(e) => setInquiryOther(e.target.value)}
              rows={2}
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Are you bringing information from another system?</h2>
        {BRING_BUSINESS_OPTIONS.map((opt) => (
          <label
            key={opt.key}
            className="flex cursor-pointer gap-3 rounded-md border p-3 text-sm has-[:checked]:border-primary"
          >
            <input
              type="radio"
              name="bringBusiness"
              className="mt-1"
              checked={bringBusiness === opt.key}
              onChange={() => setBringBusiness(opt.key)}
            />
            <span>
              <span className="font-medium">{opt.title}</span>
              <span className="mt-1 block text-muted-foreground">{opt.description}</span>
            </span>
          </label>
        ))}
      </section>

      {mode === "self_setup" && bringBusiness === "starting_fresh" ? (
        <section className="space-y-3 rounded-md border bg-muted/30 p-4">
          <h2 className="text-lg font-medium">We&apos;ve already prepared a few things for you.</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ve added starter offerings, client experience templates, and your lead
            capture setup so you have something to work from.
          </p>
          <p className="text-sm font-medium">Use these for now</p>
          <p className="text-sm text-muted-foreground">
            You can customize them whenever you&apos;re ready.
          </p>
        </section>
      ) : null}

      {mode === "white_glove" && materialsSlot ? (
        <section className="space-y-4">{materialsSlot}</section>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
