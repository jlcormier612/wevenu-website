"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

import {
  saveTextingRegistrationDraftAction,
  startTextingSetupAction,
  submitTextingRegistrationAction,
} from "@/app/(app)/settings/texting-registration-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isBusinessIdentityComplete } from "@/lib/texting-registration/validation";
import { maskRegistrationNumberLast4 } from "@/lib/texting-registration/sensitive-field";
import type { TextingSetupBundle } from "@/lib/texting-registration/service";
import type {
  TextingPanelTone,
  TextingRegistrationInput,
  TextingSetupWizardStep,
  TextingStatusPanel,
} from "@/lib/texting-registration/types";
import {
  BUSINESS_TYPE_OPTIONS,
  INDUSTRY_OPTIONS,
  INFORMATION_SAVED_STATUS_COPY,
  JOB_POSITION_OPTIONS,
  REGION_OPTIONS,
  REGISTRATION_ID_TYPE_OPTIONS,
} from "@/lib/texting-registration/types";

const TONE_CLASS: Record<TextingPanelTone, string> = {
  ready: "text-success",
  confirmed: "text-success",
  pending: "text-amber-700",
  needs_attention: "text-destructive",
  not_ready: "text-muted-foreground",
  paused: "text-amber-700",
};

function StatusPanelView({ panel }: { panel: TextingStatusPanel }) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const rows: { title: string; label: string; tone: TextingPanelTone }[] = [
    { title: "Business information", label: panel.businessInformation.label, tone: panel.businessInformation.tone },
    { title: "Texting setup", label: panel.messagingRegistration.label, tone: panel.messagingRegistration.tone },
    { title: "Texting number", label: panel.textingNumber.label, tone: panel.textingNumber.tone },
    { title: "Texting", label: panel.texting.label, tone: panel.texting.tone },
  ];

  const headline =
    panel.smsReady ? "Ready"
      : panel.phase === "information_saved" ? "Information saved"
        : panel.phase === "under_review" ? "Under review"
          : panel.phase === "needs_attention" || panel.phase === "failed" ? "Needs attention"
            : panel.phase === "paused" ? "Paused"
              : panel.phase === "setting_up_number" ? "Setting up"
                : "Not ready";

  const nextStep =
    panel.smsReady
      ? "You’re ready to text from Inbox."
      : panel.phase === "information_saved"
        ? INFORMATION_SAVED_STATUS_COPY
        : panel.phase === "under_review"
          ? "Your texting setup is being reviewed. We’ll assign your texting number when it’s ready."
          : panel.attention?.message
            ?? "Complete the steps below to enable text messaging for your venue.";

  return (
    <div className="space-y-4">
      {panel.attention && (panel.phase === "needs_attention" || panel.phase === "failed") && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <p className="text-sm font-medium text-heading">
            {panel.attention.message}
          </p>
          {panel.attention.fixHint && (
            <p className="text-xs text-muted-foreground">{panel.attention.fixHint}</p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card px-4 py-3.5 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-heading">Status</p>
          <p className={`text-sm font-medium ${TONE_CLASS[panel.texting.tone]}`}>{headline}</p>
        </div>
        <p className="text-sm text-muted-foreground">{nextStep}</p>
        <p className="text-xs text-muted-foreground">
          HTC handles the technical setup for you. We use your business information to help establish texting for your venue.
        </p>
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="text-xs font-medium text-heading underline-offset-2 hover:underline"
        >
          {detailsOpen ? "Hide details" : "View details"}
        </button>
      </div>

      {detailsOpen && (
        <dl className="divide-y divide-border rounded-sm border border-border overflow-hidden">
          {rows.map((r) => (
            <div
              key={r.title}
              className="px-4 py-3.5 bg-card grid gap-1 sm:grid-cols-[12rem_1fr] sm:gap-4"
            >
              <dt className="text-sm font-medium text-heading">{r.title}</dt>
              <dd className={`text-sm font-medium ${TONE_CLASS[r.tone]}`}>{r.label}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  children,
  error,
  hint,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-heading">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function TextMessagingSetupSection({
  initial,
}: {
  initial: TextingSetupBundle | null;
}) {
  const [bundle, setBundle] = React.useState(initial);
  const [step, setStep] = React.useState<TextingSetupWizardStep>(() => {
    if (!initial || initial.phase === "not_started") return "intro";
    if (
      initial.phase === "information_saved"
      || initial.phase === "under_review"
      || initial.phase === "setting_up_number"
      || initial.phase === "ready"
      || initial.phase === "paused"
    ) {
      return "status";
    }
    if (initial.phase === "needs_attention" || initial.phase === "failed") {
      return "status";
    }
    return isBusinessIdentityComplete(initial.prefill)
      ? "additional_details"
      : "confirm_business";
  });
  const [form, setForm] = React.useState<TextingRegistrationInput>(
    initial?.prefill ?? {
      businessName: "",
      websiteUrl: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      stateRegion: "",
      postalCode: "",
      country: "",
      contactEmail: "",
      contactPhone: "",
      businessType: "",
      businessIndustry: "",
      registrationIdType: "",
      registrationNumber: "",
      regionsOfOperation: "",
      repFirstName: "",
      repLastName: "",
      repEmail: "",
      repPhone: "",
      repBusinessTitle: "",
      repJobPosition: "",
      messagingPurpose: "",
      sampleMessage1: "",
      sampleMessage2: "",
      optInDescription: "",
      privacyPolicyUrl: "",
      termsUrl: "",
    },
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  function setField<K extends keyof TextingRegistrationInput>(key: K, value: TextingRegistrationInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function beginSetup() {
    startTransition(async () => {
      const result = await startTextingSetupAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setBundle((prev) =>
        prev
          ? { ...prev, registration: result.registration, phase: result.registration.phase, canEdit: true }
          : prev,
      );
      setStep(
        isBusinessIdentityComplete(form) ? "additional_details" : "confirm_business",
      );
    });
  }

  function saveAndContinue(next: TextingSetupWizardStep) {
    startTransition(async () => {
      const result = await saveTextingRegistrationDraftAction(form);
      if (!result.ok) {
        toast.error(result.message);
        if (result.errors) setErrors(result.errors);
        return;
      }
      setErrors({});
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              registration: result.registration,
              phase: result.registration.phase,
              prefill: { ...form, registrationNumber: "" },
            }
          : prev,
      );
      setStep(next);
    });
  }

  function submit() {
    startTransition(async () => {
      const result = await submitTextingRegistrationAction(form);
      if (!result.ok) {
        toast.error(result.message);
        if (result.errors) setErrors(result.errors);
        return;
      }
      setErrors({});
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              registration: result.registration,
              phase: result.registration.phase,
              statusPanel: result.statusPanel,
              canEdit: false,
              prefill: { ...form, registrationNumber: "" },
            }
          : prev,
      );
      setForm((f) => ({ ...f, registrationNumber: "" }));
      setStep("status");
      toast.success(
        result.registration.phase === "under_review"
          ? "Texting setup submitted for review."
          : "Your texting information is saved.",
      );
    });
  }

  const phase = bundle?.phase ?? "not_started";
  const canConfigure = bundle?.canConfigure !== false;
  const showStatus =
    !canConfigure
    || step === "status"
    || phase === "information_saved"
    || phase === "under_review"
    || phase === "needs_attention"
    || phase === "failed"
    || phase === "ready"
    || phase === "setting_up_number"
    || phase === "paused";
  const showWizard =
    canConfigure
    && (
      phase === "not_started"
      || phase === "details_needed"
      || phase === "information_saved"
      || phase === "needs_attention"
      || phase === "failed"
    );

  return (
    <Card id="texting" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          Text messaging
        </CardTitle>
        <CardDescription>
          Connect texting to your venue so you can communicate with clients and leads from HTC.
          Hello to Cheers handles the complicated setup behind the scenes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!canConfigure && (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Only a venue owner or manager can enable or change text messaging setup.
            You can still view the current status below.
          </p>
        )}

        {showWizard && step === "intro" && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              We’ll connect your venue to a dedicated texting number. To register your business
              for texting, we need a few details.
            </p>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>Confirm your business name and address</li>
              <li>Provide registration details needed for texting (you choose each answer)</li>
              <li>Tell us what you’ll text couples about</li>
            </ul>
            {phase === "not_started" ? (
              <Button type="button" onClick={() => void beginSetup()} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enable text messaging
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() =>
                  setStep(
                    isBusinessIdentityComplete(form) ? "additional_details" : "confirm_business",
                  )
                }
              >
                Continue setup
              </Button>
            )}
          </div>
        )}

        {showWizard && step === "confirm_business" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-heading">Confirm business information</h3>
              <p className="text-xs text-muted-foreground mt-1">
                We’ve filled this from your venue profile. Fix anything that’s outdated.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="businessName" label="Legal business name" error={errors.businessName}>
                <Input id="businessName" value={form.businessName} onChange={(e) => setField("businessName", e.target.value)} />
              </Field>
              <Field id="websiteUrl" label="Website" error={errors.websiteUrl}>
                <Input id="websiteUrl" value={form.websiteUrl} onChange={(e) => setField("websiteUrl", e.target.value)} placeholder="https://" />
              </Field>
              <Field id="addressLine1" label="Street address" error={errors.addressLine1}>
                <Input id="addressLine1" value={form.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)} />
              </Field>
              <Field id="addressLine2" label="Address line 2">
                <Input id="addressLine2" value={form.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)} />
              </Field>
              <Field id="city" label="City" error={errors.city}>
                <Input id="city" value={form.city} onChange={(e) => setField("city", e.target.value)} />
              </Field>
              <Field id="stateRegion" label="State" error={errors.stateRegion}>
                <Input id="stateRegion" value={form.stateRegion} onChange={(e) => setField("stateRegion", e.target.value)} />
              </Field>
              <Field id="postalCode" label="Postal code" error={errors.postalCode}>
                <Input id="postalCode" value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)} />
              </Field>
              <Field id="country" label="Country" error={errors.country}>
                <Input id="country" value={form.country} onChange={(e) => setField("country", e.target.value)} />
              </Field>
              <Field id="contactEmail" label="Contact email" error={errors.contactEmail}>
                <Input id="contactEmail" type="email" value={form.contactEmail} onChange={(e) => setField("contactEmail", e.target.value)} />
              </Field>
              <Field id="contactPhone" label="Contact phone" error={errors.contactPhone}>
                <Input id="contactPhone" value={form.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("intro")} disabled={pending}>
                Back
              </Button>
              <Button type="button" onClick={() => saveAndContinue("additional_details")} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue
              </Button>
            </div>
          </div>
        )}

        {showWizard && step === "additional_details" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-medium text-heading">Additional details</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Needed to register texting for your business. Please choose each answer yourself —
                we don’t fill in legal or registration details for you.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="businessType" label="Business type" error={errors.businessType}
                hint="How your business is legally organized.">
                <select
                  id="businessType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.businessType}
                  onChange={(e) => setField("businessType", e.target.value)}
                >
                  <option value="">Select…</option>
                  {BUSINESS_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field id="businessIndustry" label="Industry" error={errors.businessIndustry}>
                <select
                  id="businessIndustry"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.businessIndustry}
                  onChange={(e) => setField("businessIndustry", e.target.value)}
                >
                  <option value="">Select…</option>
                  {INDUSTRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field
                id="registrationIdType"
                label="Registration ID type"
                error={errors.registrationIdType}
                hint="Required for texting registration — usually an EIN in the US."
              >
                <select
                  id="registrationIdType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.registrationIdType}
                  onChange={(e) => setField("registrationIdType", e.target.value)}
                >
                  <option value="">Select…</option>
                  {REGISTRATION_ID_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field
                id="regionsOfOperation"
                label="Where you operate"
                error={errors.regionsOfOperation}
                hint="Required for texting registration."
              >
                <select
                  id="regionsOfOperation"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.regionsOfOperation}
                  onChange={(e) => setField("regionsOfOperation", e.target.value)}
                >
                  <option value="">Select…</option>
                  {REGION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field
                id="registrationNumber"
                label="Business registration number"
                error={errors.registrationNumber}
                hint={
                  bundle?.registration?.hasRegistrationNumber
                    ? `On file: ${maskRegistrationNumberLast4(bundle.registration.registrationNumberLast4)}. Leave blank to keep it.`
                    : "Stored securely. Never shown in Inbox."
                }
              >
                <Input
                  id="registrationNumber"
                  autoComplete="off"
                  value={form.registrationNumber}
                  onChange={(e) => setField("registrationNumber", e.target.value)}
                  placeholder={bundle?.registration?.hasRegistrationNumber ? "••••" : ""}
                />
              </Field>
            </div>

            <div>
              <h4 className="text-sm font-medium text-heading mb-2">Authorized representative</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="repFirstName" label="First name" error={errors.repFirstName}>
                  <Input id="repFirstName" value={form.repFirstName} onChange={(e) => setField("repFirstName", e.target.value)} />
                </Field>
                <Field id="repLastName" label="Last name" error={errors.repLastName}>
                  <Input id="repLastName" value={form.repLastName} onChange={(e) => setField("repLastName", e.target.value)} />
                </Field>
                <Field id="repEmail" label="Email" error={errors.repEmail}>
                  <Input id="repEmail" type="email" value={form.repEmail} onChange={(e) => setField("repEmail", e.target.value)} />
                </Field>
                <Field id="repPhone" label="Phone" error={errors.repPhone}>
                  <Input id="repPhone" value={form.repPhone} onChange={(e) => setField("repPhone", e.target.value)} />
                </Field>
                <Field id="repBusinessTitle" label="Title" error={errors.repBusinessTitle}>
                  <Input id="repBusinessTitle" value={form.repBusinessTitle} onChange={(e) => setField("repBusinessTitle", e.target.value)} placeholder="Owner" />
                </Field>
                <Field id="repJobPosition" label="Role" error={errors.repJobPosition}>
                  <select
                    id="repJobPosition"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.repJobPosition}
                    onChange={(e) => setField("repJobPosition", e.target.value)}
                  >
                    <option value="">Select…</option>
                    {JOB_POSITION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-heading">What you’ll text about</h4>
              <Field id="messagingPurpose" label="Purpose" error={errors.messagingPurpose}
                hint="Plain language — e.g. booking questions, tour reminders, and event logistics.">
                <Textarea id="messagingPurpose" rows={2} value={form.messagingPurpose} onChange={(e) => setField("messagingPurpose", e.target.value)} />
              </Field>
              <Field id="sampleMessage1" label="Sample text message" error={errors.sampleMessage1}>
                <Textarea id="sampleMessage1" rows={2} value={form.sampleMessage1} onChange={(e) => setField("sampleMessage1", e.target.value)}
                  placeholder="Hi Sarah — this is Maple Hall confirming your tour on Saturday at 2pm." />
              </Field>
              <Field id="sampleMessage2" label="Second sample (optional)">
                <Textarea id="sampleMessage2" rows={2} value={form.sampleMessage2} onChange={(e) => setField("sampleMessage2", e.target.value)} />
              </Field>
              <Field id="optInDescription" label="How people opt in" error={errors.optInDescription}
                hint="e.g. They share their mobile number on our inquiry form and agree to receive texts.">
                <Textarea id="optInDescription" rows={2} value={form.optInDescription} onChange={(e) => setField("optInDescription", e.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="privacyPolicyUrl" label="Privacy policy URL" error={errors.privacyPolicyUrl}>
                  <Input id="privacyPolicyUrl" value={form.privacyPolicyUrl} onChange={(e) => setField("privacyPolicyUrl", e.target.value)} placeholder="https://" />
                </Field>
                <Field id="termsUrl" label="Terms of service URL" error={errors.termsUrl}>
                  <Input id="termsUrl" value={form.termsUrl} onChange={(e) => setField("termsUrl", e.target.value)} placeholder="https://" />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("confirm_business")} disabled={pending}>
                Back
              </Button>
              <Button type="button" onClick={() => saveAndContinue("review")} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Review
              </Button>
            </div>
          </div>
        )}

        {showWizard && step === "review" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-heading">Review &amp; save</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Double-check these details. We’ll save them for your venue. Hello to Cheers will complete
                texting setup once registration is available — this step does not mean registration
                has already been submitted for approval.
              </p>
            </div>
            <dl className="text-sm space-y-2 rounded-sm border border-border p-4 bg-card">
              <div><span className="text-muted-foreground">Business: </span>{form.businessName}</div>
              <div><span className="text-muted-foreground">Website: </span>{form.websiteUrl}</div>
              <div>
                <span className="text-muted-foreground">Address: </span>
                {[form.addressLine1, form.city, form.stateRegion, form.postalCode].filter(Boolean).join(", ")}
              </div>
              <div>
                <span className="text-muted-foreground">Representative: </span>
                {form.repFirstName} {form.repLastName}
              </div>
              <div><span className="text-muted-foreground">Purpose: </span>{form.messagingPurpose}</div>
              {bundle?.registration?.hasRegistrationNumber || form.registrationNumber ? (
                <div>
                  <span className="text-muted-foreground">Registration number: </span>
                  {form.registrationNumber
                    ? maskRegistrationNumberLast4(form.registrationNumber.replace(/\D/g, "").slice(-4))
                    : maskRegistrationNumberLast4(bundle?.registration?.registrationNumberLast4)}
                </div>
              ) : null}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("additional_details")} disabled={pending}>
                Back
              </Button>
              <Button type="button" onClick={() => void submit()} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save texting information
              </Button>
            </div>
          </div>
        )}

        {showStatus && bundle && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-heading">Texting setup</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Current status for your venue’s text messaging.
              </p>
            </div>
            <StatusPanelView panel={bundle.statusPanel} />
            {(canConfigure && (phase === "needs_attention" || phase === "failed" || phase === "information_saved")) && (
              <Button
                type="button"
                onClick={() => setStep("additional_details")}
                disabled={pending}
              >
                {phase === "information_saved" ? "Update details" : "Update details & resubmit"}
              </Button>
            )}
            {canConfigure && phase === "details_needed" && (
              <Button type="button" onClick={() => setStep("confirm_business")}>
                Continue setup
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Need help?{" "}
              <Link href="/messaging/health" className="underline underline-offset-2 text-heading">
                Communication Health
              </Link>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
