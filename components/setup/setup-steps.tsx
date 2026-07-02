"use client";

import * as React from "react";

import {
  ArrowRight,
  Building2,
  CalendarClock,
  CreditCard,
  Sparkles,
  UserRound,
} from "lucide-react";

import { Field, SummaryRow } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { ColorPickerTrigger } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  CURRENCIES,
  DAYS_OF_WEEK,
  type Option,
  TIME_ZONES,
  VENUE_TYPES,
  WEEK_START_OPTIONS,
} from "@/lib/venue/constants";
import type {
  BusinessHourInput,
  VenueSetupErrors,
  VenueSetupInput,
} from "@/lib/venue/types";
import { type SetupStepId } from "@/lib/venue/validation";

export const STEP_META: Record<
  SetupStepId,
  { title: string; description: string }
> = {
  "venue-info": {
    title: "Venue information",
    description: "The essentials your guests and contracts will reference.",
  },
  "venue-details": {
    title: "Venue profile",
    description: "Type, capacity, and the time zone your venue runs on.",
  },
  "business-hours": {
    title: "Business hours",
    description: "When your venue is open for tours and events.",
  },
  brand: {
    title: "Brand settings",
    description: "Make the workspace feel like your venue.",
  },
  owner: {
    title: "Owner & settings",
    description: "Who owns this venue, plus a couple of basics.",
  },
  payments: {
    title: "Payments",
    description: "Connect Stripe to take deposits and payments.",
  },
  review: {
    title: "Review & create",
    description: "Confirm everything looks right, then create your venue.",
  },
};

export type StepProps = {
  input: VenueSetupInput;
  errors: VenueSetupErrors;
  set: <K extends keyof VenueSetupInput>(
    key: K,
    value: VenueSetupInput[K],
  ) => void;
  setHour: (dayOfWeek: number, patch: Partial<BusinessHourInput>) => void;
  goToStep?: (step: SetupStepId) => void;
};

// ---- local helpers ----------------------------------------------------------

function labelFor(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  placeholder,
  required,
  autoComplete,
  inputMode,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: React.ComponentProps<typeof Input>["inputMode"];
  className?: string;
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function SelectField({
  id,
  label,
  value,
  onValueChange,
  options,
  placeholder,
  error,
  hint,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      required={required}
      error={error}
      hint={hint}
    >
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} aria-invalid={error ? true : undefined}>
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// ---- Welcome ----------------------------------------------------------------

export function WelcomeStep({ onStart }: { onStart: () => void }) {
  const points = [
    { icon: Building2, text: "Your venue's name, contact details, and location" },
    { icon: CalendarClock, text: "Capacity, time zone, and business hours" },
    { icon: Sparkles, text: "Brand colors and your owner profile" },
    { icon: CreditCard, text: "Payments setup (you can connect Stripe later)" },
  ];
  return (
    <div className="mx-auto max-w-xl space-y-8 py-8 text-center">
      <div className="space-y-3">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="h-7 w-7" />
        </span>
        <h1 className="font-heading text-3xl font-medium tracking-tight text-heading">
          Let&apos;s build your venue
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Everything in Wevenu begins with your venue. We&apos;ll set up the
          foundation now — it only takes a few minutes, and you can refine any of
          it later.
        </p>
      </div>

      <ul className="mx-auto max-w-md space-y-3 text-left">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-heading">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="text-sm text-foreground">{text}</span>
          </li>
        ))}
      </ul>

      <Button size="lg" onClick={onStart} className="w-full sm:w-auto">
        Get started
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

// ---- Venue information -------------------------------------------------------

export function VenueInfoStep({ input, errors, set }: StepProps) {
  return (
    <div className="space-y-5">
      <TextField
        id="name"
        label="Venue name"
        required
        value={input.name}
        onChange={(v) => set("name", v)}
        error={errors.name}
        placeholder="The Wildflower Estate"
        autoComplete="organization"
      />
      <TextField
        id="businessName"
        label="Legal business name"
        value={input.businessName}
        onChange={(v) => set("businessName", v)}
        hint="Used on contracts and invoices. Leave blank if it's the same."
        placeholder="Wildflower Events LLC"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="email"
          label="Email"
          type="email"
          value={input.email}
          onChange={(v) => set("email", v)}
          error={errors.email}
          placeholder="hello@wildflower.com"
          autoComplete="email"
        />
        <TextField
          id="phone"
          label="Phone"
          type="tel"
          value={input.phone}
          onChange={(v) => set("phone", v)}
          placeholder="(555) 123-4567"
          autoComplete="tel"
        />
      </div>
      <TextField
        id="website"
        label="Website"
        value={input.website}
        onChange={(v) => set("website", v)}
        error={errors.website}
        placeholder="wildflowerestate.com"
        inputMode="url"
      />

      <Separator />

      <TextField
        id="addressLine1"
        label="Address"
        value={input.addressLine1}
        onChange={(v) => set("addressLine1", v)}
        placeholder="123 Meadow Lane"
        autoComplete="address-line1"
      />
      <TextField
        id="addressLine2"
        label="Address line 2"
        value={input.addressLine2}
        onChange={(v) => set("addressLine2", v)}
        placeholder="Suite, building, etc. (optional)"
        autoComplete="address-line2"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="city"
          label="City"
          value={input.city}
          onChange={(v) => set("city", v)}
          autoComplete="address-level2"
        />
        <TextField
          id="stateRegion"
          label="State / Region"
          value={input.stateRegion}
          onChange={(v) => set("stateRegion", v)}
          autoComplete="address-level1"
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="postalCode"
          label="Postal code"
          value={input.postalCode}
          onChange={(v) => set("postalCode", v)}
          autoComplete="postal-code"
        />
        <TextField
          id="country"
          label="Country"
          value={input.country}
          onChange={(v) => set("country", v)}
          autoComplete="country-name"
        />
      </div>
    </div>
  );
}

// ---- Venue profile ----------------------------------------------------------

export function VenueDetailsStep({ input, errors, set }: StepProps) {
  return (
    <div className="space-y-5">
      <SelectField
        id="venueType"
        label="Venue type"
        value={input.venueType}
        onValueChange={(v) => set("venueType", v)}
        options={VENUE_TYPES}
        placeholder="Choose a venue type"
        error={errors.venueType}
      />
      <TextField
        id="capacity"
        label="Maximum capacity"
        type="number"
        inputMode="numeric"
        value={input.capacity}
        onChange={(v) => set("capacity", v)}
        error={errors.capacity}
        hint="Total seated or standing guests your venue can host."
        placeholder="200"
      />
      <SelectField
        id="timezone"
        label="Time zone"
        required
        value={input.timezone}
        onValueChange={(v) => set("timezone", v)}
        options={TIME_ZONES}
        placeholder="Select a time zone"
        error={errors.timezone}
      />
    </div>
  );
}

// ---- Business hours ---------------------------------------------------------

export function BusinessHoursStep({ input, errors, setHour }: StepProps) {
  const byDay = new Map(input.businessHours.map((h) => [h.dayOfWeek, h]));
  return (
    <div className="space-y-3">
      {DAYS_OF_WEEK.map((day) => {
        const h = byDay.get(day.value);
        if (!h) return null;
        const error = errors[`hours.${day.value}`];
        return (
          <div
            key={day.value}
            className="rounded-lg border border-border p-3"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={h.isOpen}
                  onCheckedChange={(c) => setHour(day.value, { isOpen: c })}
                  aria-label={`${day.label} open`}
                />
                <span className="w-24 text-sm font-medium text-heading">
                  {day.label}
                </span>
              </div>
              {h.isOpen ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={h.openTime}
                    aria-label={`${day.label} opening time`}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) =>
                      setHour(day.value, { openTime: e.target.value })
                    }
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={h.closeTime}
                    aria-label={`${day.label} closing time`}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) =>
                      setHour(day.value, { closeTime: e.target.value })
                    }
                    className="w-32"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Closed</span>
              )}
            </div>
            {error ? (
              <p className="mt-2 text-xs text-foreground">{error}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---- Brand ------------------------------------------------------------------

const COLOR_ROLES: {
  key: "primaryColor" | "secondaryColor" | "accentColor" | "neutralColor";
  label: string;
  hint: string;
}[] = [
  { key: "primaryColor",   label: "Primary",   hint: "Main brand color — buttons, headers, accents" },
  { key: "secondaryColor", label: "Secondary",  hint: "Supports the primary — sidebar, badges" },
  { key: "accentColor",    label: "Accent",     hint: "Warm tone — highlights, cards, hover states" },
  { key: "neutralColor",   label: "Neutral",    hint: "Background tone — page canvas, section fills" },
];

export function BrandStep({ input, errors, set }: StepProps) {
  return (
    <div className="space-y-6">
      {/* 4-color palette */}
      <div className="grid gap-5 sm:grid-cols-2">
        {COLOR_ROLES.map(({ key, label, hint }) => (
          <Field key={key} label={label} hint={hint} error={errors[key]}>
            <ColorPickerTrigger
              value={input[key]}
              onChange={(v) => set(key, v)}
            />
          </Field>
        ))}
      </div>

      {/* Live preview strip */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Preview
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_ROLES.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <span
                className="h-10 w-10 rounded-lg border border-border shadow-sm"
                style={{ backgroundColor: input[key] }}
              />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
          <span
            className="ml-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm"
            style={{ backgroundColor: input.primaryColor }}
          >
            {input.name.trim() || "Your venue"}
          </span>
          <span
            className="rounded-md px-3 py-1.5 text-xs font-medium border"
            style={{
              backgroundColor: input.neutralColor,
              borderColor: input.accentColor,
              color: input.primaryColor,
            }}
          >
            Upcoming event
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Your logo can be added anytime from Settings after setup.
        </p>
      </div>
    </div>
  );
}

// ---- Owner & settings -------------------------------------------------------

export function OwnerStep({ input, errors, set }: StepProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/40 text-heading">
          <UserRound className="h-4.5 w-4.5" />
        </span>
        <p className="text-sm text-muted-foreground">
          You&apos;ll be recorded as the venue owner. You can add more staff
          later.
        </p>
      </div>
      <TextField
        id="ownerFullName"
        label="Owner name"
        required
        value={input.ownerFullName}
        onChange={(v) => set("ownerFullName", v)}
        error={errors.ownerFullName}
        placeholder="Jordan Rivera"
        autoComplete="name"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="ownerTitle"
          label="Title"
          value={input.ownerTitle}
          onChange={(v) => set("ownerTitle", v)}
          placeholder="Owner"
        />
        <TextField
          id="ownerEmail"
          label="Owner email"
          type="email"
          value={input.ownerEmail}
          onChange={(v) => set("ownerEmail", v)}
          error={errors.ownerEmail}
          autoComplete="email"
        />
      </div>

      <Separator />
      <p className="text-sm font-medium text-heading">Basic settings</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          id="currency"
          label="Currency"
          value={input.currency}
          onValueChange={(v) => set("currency", v)}
          options={CURRENCIES}
        />
        <SelectField
          id="weekStartsOn"
          label="Week starts on"
          value={String(input.weekStartsOn)}
          onValueChange={(v) => set("weekStartsOn", Number(v))}
          options={WEEK_START_OPTIONS}
        />
      </div>
    </div>
  );
}

// ---- Payments (Stripe placeholder) ------------------------------------------

export function PaymentsStep() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-heading">
            <CreditCard className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-heading">
                Stripe Connect
              </p>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                Not connected
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Connect Stripe to collect deposits, send invoices, and take
              payments directly through Wevenu.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" className="mt-4 w-full" disabled>
          Connect with Stripe — coming soon
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Payment processing isn&apos;t live yet. Your venue will be created
        without it, and you can connect Stripe later from Settings — nothing
        will be charged in the meantime.
      </p>
    </div>
  );
}

// ---- Review -----------------------------------------------------------------

function ReviewSection({
  title,
  step,
  goToStep,
  children,
}: {
  title: string;
  step: SetupStepId;
  goToStep?: (step: SetupStepId) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium text-heading">{title}</p>
        {goToStep ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => goToStep(step)}
          >
            Edit
          </Button>
        ) : null}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function formatHours(input: VenueSetupInput): string {
  const byDay = new Map(input.businessHours.map((h) => [h.dayOfWeek, h]));
  const open = DAYS_OF_WEEK.filter((d) => byDay.get(d.value)?.isOpen);
  if (open.length === 0) return "Closed all week";
  return `${open.length} day${open.length === 1 ? "" : "s"} open`;
}

export function ReviewStep({ input, goToStep }: StepProps) {
  const address = [
    input.addressLine1,
    input.addressLine2,
    [input.city, input.stateRegion].filter(Boolean).join(", "),
    [input.postalCode, input.country].filter(Boolean).join(" "),
  ]
    .filter((s) => s && s.trim())
    .join(" · ");

  return (
    <div className="space-y-4">
      <ReviewSection title="Venue information" step="venue-info" goToStep={goToStep}>
        <SummaryRow label="Name" value={input.name} />
        <SummaryRow label="Business name" value={input.businessName} />
        <SummaryRow label="Email" value={input.email} />
        <SummaryRow label="Phone" value={input.phone} />
        <SummaryRow label="Website" value={input.website} />
        <SummaryRow label="Address" value={address} />
      </ReviewSection>

      <ReviewSection title="Profile" step="venue-details" goToStep={goToStep}>
        <SummaryRow
          label="Type"
          value={input.venueType ? labelFor(VENUE_TYPES, input.venueType) : ""}
        />
        <SummaryRow label="Capacity" value={input.capacity} />
        <SummaryRow label="Time zone" value={labelFor(TIME_ZONES, input.timezone)} />
      </ReviewSection>

      <ReviewSection title="Business hours" step="business-hours" goToStep={goToStep}>
        <SummaryRow label="Schedule" value={formatHours(input)} />
      </ReviewSection>

      <ReviewSection title="Brand" step="brand" goToStep={goToStep}>
        <div className="flex items-center justify-between py-1.5 text-sm">
          <span className="text-muted-foreground">Colors</span>
          <span className="flex items-center gap-1.5">
            {(["primaryColor","secondaryColor","accentColor","neutralColor"] as const).map(k => (
              <span
                key={k}
                className="h-5 w-5 rounded-md border border-border"
                style={{ backgroundColor: input[k] }}
                title={input[k]}
              />
            ))}
          </span>
        </div>
      </ReviewSection>

      <ReviewSection title="Owner & settings" step="owner" goToStep={goToStep}>
        <SummaryRow label="Owner" value={input.ownerFullName} />
        <SummaryRow label="Title" value={input.ownerTitle} />
        <SummaryRow label="Owner email" value={input.ownerEmail} />
        <SummaryRow label="Currency" value={input.currency} />
        <SummaryRow
          label="Week starts on"
          value={labelFor(WEEK_START_OPTIONS, String(input.weekStartsOn))}
        />
      </ReviewSection>

      <ReviewSection title="Payments" step="payments" goToStep={goToStep}>
        <SummaryRow label="Stripe" value="Not connected" />
      </ReviewSection>
    </div>
  );
}
