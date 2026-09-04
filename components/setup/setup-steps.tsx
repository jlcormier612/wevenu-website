"use client";

import * as React from "react";

import {
  Building2,
  Check,
  RefreshCw,
  Sparkles,
  UserRound,
} from "lucide-react";

import { useSetupReadyCounts } from "@/components/setup/setup-migration-steps";

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
import { getLeadCaptureStepDataAction } from "@/app/setup/actions";
import { WebsiteFormsSection } from "@/components/settings/website-forms-section";
import type { Venue } from "@/lib/venue/types";
import type { EmailIntakeStatus } from "@/lib/lead-intake/email-status";
import type { InquiryFormSettings } from "@/lib/inquiry-form/types";

/**
 * Shared onboarding guidance (2026-08-17) — every step tells the venue what
 * we're doing, why it matters, what they need, and what happens next.
 * Rendered once by the wizard shell (components/setup/setup-wizard.tsx), not
 * per-step, so every step gets the same consistent guidance treatment.
 */
export const STEP_META: Record<
  SetupStepId,
  {
    title: string;
    description: string;
    whatWereDoing: string;
    whyItMatters: string;
    whatYouNeed: string;
    whatHappensNext: string;
  }
> = {
  "venue-info": {
    title: "Venue information",
    description: "The essentials your guests and contracts will reference.",
    whatWereDoing: "Tell us the basics about your venue.",
    whyItMatters: "This is what shows up on contracts, invoices, and anywhere couples look you up.",
    whatYouNeed: "Your venue's name, contact details, and address.",
    whatHappensNext: "We'll move on to your venue's profile — type, capacity, and time zone.",
  },
  "venue-details": {
    title: "Venue profile",
    description: "Type, capacity, and the time zone your venue runs on.",
    whatWereDoing: "Set your venue's type, capacity, and time zone.",
    whyItMatters: "These drive availability, scheduling, and how your venue is categorized.",
    whatYouNeed: "Your venue type, maximum guest capacity, and the time zone you operate in.",
    whatHappensNext: "Next, set your regular business hours.",
  },
  "business-hours": {
    title: "Business hours",
    description: "When your venue is open for business.",
    whatWereDoing: "Set your venue's general business hours.",
    whyItMatters: "These are your venue's general business hours — when your venue is open and available for business. Your tour availability is set separately, so you don't need to schedule tour times here.",
    whatYouNeed: "Your open and close times for each day of the week.",
    whatHappensNext: "Next, choose your brand colors.",
  },
  brand: {
    title: "Brand settings",
    description: "Choose colors for the materials you share with clients.",
    whatWereDoing: "Pick the colors used on emails, proposals, contracts, and other materials you send.",
    whyItMatters: "These colors show up on client-facing materials you create or send — not on the Hello to Cheers app itself.",
    whatYouNeed: "Four colors — primary, secondary, accent, and neutral. You can add a logo later from Settings.",
    whatHappensNext: "Next, confirm who owns this venue and a couple of basic settings.",
  },
  owner: {
    title: "Owner & settings",
    description: "Who owns this venue, plus a couple of basics.",
    whatWereDoing: "Confirm the venue owner and a couple of basic settings.",
    whyItMatters: "The owner is recorded on the account, and currency/week-start affect how dates and totals are shown.",
    whatYouNeed: "The owner's name, title, and email, plus your currency and preferred week start.",
    whatHappensNext: "With the basics done, we'll help you bring over anything you already have.",
  },
  "bring-your-business": {
    title: "Bring your business",
    description: "Already have information somewhere else? Start with what you have.",
    whatWereDoing: "Bring in the leads, clients, and business you already have.",
    whyItMatters: "Starting with your real data means your workspace is useful from day one, not empty.",
    whatYouNeed: "A CSV/Excel export, files, or nothing at all if you'd rather start fresh.",
    whatHappensNext: "Next, we'll check what packages and inventory you're offering.",
  },
  "your-offerings": {
    title: "Your offerings",
    description: "Packages and inventory — what you sell and what you set up with.",
    whatWereDoing: "Check your packages and inventory.",
    whyItMatters: "These are what couples see and what your team books against.",
    whatYouNeed: "Nothing required here — bring these over now or add them later from the Library.",
    whatHappensNext: "Next, we'll check your contract wording, message templates, and planning checklists.",
  },
  "business-tools": {
    title: "Your business tools",
    description: "Contract wording, message wording, and planning checklists.",
    whatWereDoing: "Check your contract wording, message templates, and planning checklists.",
    whyItMatters: "These are the reusable tools your team relies on for every event.",
    whatYouNeed: "Nothing required here — these can be added anytime once you're in.",
    whatHappensNext: "Next, set up how new inquiries reach you.",
  },
  "lead-capture": {
    title: "Lead capture",
    description: "How new inquiries reach Hello to Cheers.",
    whatWereDoing: "Set up how new inquiries reach Hello to Cheers.",
    whyItMatters: "Every inquiry — from your website, a QR code, or email — should land in one place instead of getting lost.",
    whatYouNeed: "A few minutes to review your inquiry form link and, if you use one, your website.",
    whatHappensNext: "Next, we'll check the contacts, vendors, and events already on your books.",
  },
  "your-people": {
    title: "Your people & business",
    description: "Contacts, vendors, and the events already on your books.",
    whatWereDoing: "Check the contacts, vendors, and events already on your books.",
    whyItMatters: "These are the people and relationships your business runs on.",
    whatYouNeed: "Nothing required here — bring contacts or vendors over now, or add them later.",
    whatHappensNext: "Next, review everything and create your venue.",
  },
  review: {
    title: "You're off to a great start",
    description: "We've got the basics in place. Next, we'll walk you through the rest of your setup, one step at a time.",
    whatWereDoing: "Getting your venue workspace ready so you can start building out the rest of your Hello to Cheers experience.",
    whyItMatters: "These first details give us the foundation we need to help you get everything else set up correctly.",
    whatYouNeed: "Nothing else right now — you've already given us what we need to get started. And don't worry — you can come back and make edits at any point along the way.",
    whatHappensNext: "We'll keep walking you through the next steps, including bringing in your existing business information, setting up your offerings and tools, and getting your team ready.",
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
      {/* `items` is what makes Select.Value show the matched option's
          label instead of the raw stored value — Base UI, unlike Radix,
          doesn't derive that automatically from the rendered SelectItems. */}
      <Select value={value} onValueChange={onValueChange} items={options}>
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

// ---- Welcome + Path choice (onboarding persona) ------------------------------
// Pre-Launch Commercial Readiness, Initiative 1 (2026-08-03) — replaces the
// old two-screen Welcome→Origin sequence with one combined "Welcome. Let's
// get your venue ready." screen offering exactly the two paths the
// initiative specifies. The "where specifically are you coming from" detail
// (Weven / another platform / spreadsheets / files) moved to the Bring Your
// Business stage's own source picker, where the initiative's Part 4 actually
// asks for it — this screen only needs to know fresh-start vs. bringing a
// business, so onboarding_persona is set to "new" or "switching" here and
// may be refined to "weven_returning" later if Weven is picked as a source.
// Deliberately outside SETUP_STEPS, like before — no field validation, and
// nothing to persist until a real venue row exists.

function PathOptionCard({
  icon: Icon,
  title,
  description,
  emphasize,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  emphasize?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-4 rounded-xl border p-5 text-left transition-colors hover:bg-muted/30",
        emphasize
          ? "border-primary/50 bg-primary/5 hover:border-primary"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
          emphasize ? "bg-primary/15 text-primary" : "bg-accent/40 text-heading",
        )}
      >
        <Icon className="h-5.5 w-5.5" />
      </span>
      <span className="space-y-1">
        <span className="block text-base font-medium text-heading">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

export function PathChoiceStep({
  onChoose,
}: {
  onChoose: (persona: "new" | "switching") => void;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-8 py-8 text-center">
      <div className="space-y-3">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="h-7 w-7" />
        </span>
        <h1 className="font-heading text-3xl font-medium tracking-tight text-heading">
          Welcome to Hello to Cheers
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Let&apos;s get your venue ready. It only takes a few minutes, and you
          can refine anything later.
        </p>
      </div>

      <div className="mx-auto max-w-md space-y-3 text-left">
        <PathOptionCard
          icon={Sparkles}
          title="I'm starting fresh"
          description="We'll walk you through the essentials."
          onClick={() => onChoose("new")}
        />
        <PathOptionCard
          icon={RefreshCw}
          title="I'm bringing my business with me"
          description="Already using another system, spreadsheets, or existing files? Bring what you have. We'll help set up your workspace."
          emphasize
          onClick={() => onChoose("switching")}
        />
      </div>
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
  { key: "primaryColor",   label: "Primary",   hint: "Main color on emails, proposals, and contracts" },
  { key: "secondaryColor", label: "Secondary",  hint: "Supports the primary on branded materials" },
  { key: "accentColor",    label: "Accent",     hint: "Highlights on brochures and other printables" },
  { key: "neutralColor",   label: "Neutral",    hint: "Soft background tone on client-facing materials" },
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

// ---- Lead Capture (Onboarding sequence correction, 2026-08-17 — introduces
// the existing lead-capture functionality during onboarding rather than
// leaving it undiscovered in Settings. Reuses WebsiteFormsSection exactly as
// rendered on the Settings page; no parallel lead-capture system.) ----------

export function LeadCaptureStep() {
  const [data, setData] = React.useState<{
    venue: Venue | null;
    appUrl: string;
    leadEmailAddress: string | null;
    emailIntakeStatus: EmailIntakeStatus | null;
    inquiryFormSettings: InquiryFormSettings | null;
    canEditInquiryForm: boolean;
  } | null>(null);

  React.useEffect(() => {
    void getLeadCaptureStepDataAction().then(setData);
  }, []);

  if (!data) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  if (!data.venue) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Still setting up your venue — go back a step, then return here in a moment.
      </p>
    );
  }

  return (
    <WebsiteFormsSection
      embedKey={data.venue.embedKey}
      appUrl={data.appUrl}
      leadEmailAddress={data.leadEmailAddress}
      emailIntakeStatus={data.emailIntakeStatus}
      inquiryFormSettings={data.inquiryFormSettings}
      canEditInquiryForm={data.canEditInquiryForm}
    />
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

// ---- Ready to Go summary (Pre-Launch Commercial Readiness, Initiative 1, 2026-08-03) ----
// Real counts only — queried live via getSetupReadyCountsAction. A domain
// with 0 is simply omitted, never shown as a fabricated accomplishment.

function ReadyToGoSummary({ ownerFirstName }: { ownerFirstName: string }) {
  const counts = useSetupReadyCounts();
  const items: string[] = [];
  if (counts) {
    if (counts.packages > 0) items.push(`${counts.packages} package${counts.packages === 1 ? "" : "s"}`);
    if (counts.contractTemplates > 0) items.push(`${counts.contractTemplates} contract template${counts.contractTemplates === 1 ? "" : "s"}`);
    if (counts.vendorRelationships > 0) items.push(`${counts.vendorRelationships} vendor relationship${counts.vendorRelationships === 1 ? "" : "s"}`);
    if (counts.contacts > 0) items.push(`${counts.contacts} contact${counts.contacts === 1 ? "" : "s"}`);
    if (counts.upcomingEvents > 0) items.push(`${counts.upcomingEvents} upcoming event${counts.upcomingEvents === 1 ? "" : "s"}`);
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
      <p className="text-sm font-medium text-heading">
        {ownerFirstName ? `Great start, ${ownerFirstName}! ` : "Great start! "}
        We&apos;re ready for the next step.
      </p>
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Check className="h-3.5 w-3.5 shrink-0 text-success" />
        Venue profile
      </div>
      {items.map((text) => (
        <div key={text} className="flex items-center gap-2 text-sm text-foreground">
          <Check className="h-3.5 w-3.5 shrink-0 text-success" />
          {text}
        </div>
      ))}
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
      <ReadyToGoSummary ownerFirstName={input.ownerFullName.trim().split(/\s+/)[0] ?? ""} />

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
    </div>
  );
}
