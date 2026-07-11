"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createVendorAction } from "@/app/(app)/vendors/actions";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PREFERENCE_LEVELS,
  PRICING_TIERS,
  VENDOR_CATEGORIES,
  createInitialVendorInput,
} from "@/lib/vendors/constants";
import type { VendorErrors, VendorInput } from "@/lib/vendors/types";
// VendorInput["preferenceLevel"] is used inline for the Select onValueChange cast

export function VendorFormFields({
  input, errors, set, onSubmit, pending, submitLabel = "Save vendor", isClaimed = false,
}: {
  input: VendorInput;
  errors: VendorErrors;
  set: <K extends keyof VendorInput>(key: K, v: VendorInput[K]) => void;
  onSubmit: () => void;
  pending: boolean;
  submitLabel?: string;
  /** Once a vendor claims their own profile, identity fields become theirs to manage — this form only edits your relationship to them. */
  isClaimed?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="space-y-5">
      {isClaimed && (
        <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
          This vendor has claimed their own profile — their business details below are managed by their account and shown read-only here. Your preference level, notes, and pricing flag are still yours to edit.
        </div>
      )}
      <fieldset disabled={isClaimed} className="space-y-5 disabled:opacity-60">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vendor name" htmlFor="vn" required error={errors.businessName}>
          <Input id="vn" value={input.businessName} onChange={(e) => set("businessName", e.target.value)}
            placeholder="Blossoms Floral Studio" aria-invalid={errors.businessName ? true : undefined} />
        </Field>
        <Field label="Category" htmlFor="vc">
          <Select value={input.category} onValueChange={(v) => set("category", v)} items={VENDOR_CATEGORIES}>
            <SelectTrigger id="vc"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {VENDOR_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* Client-facing description + pricing */}
      <Separator />
      <p className="text-sm font-medium text-heading">Client-facing details</p>
      <Field label="Description" htmlFor="vdesc"
        hint="Shown to clients in the Vendors section of their portal.">
        <Textarea id="vdesc" value={input.description} rows={2}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Award-winning photography duo specializing in documentary-style wedding storytelling…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Photo URL" htmlFor="vphoto"
          hint="Direct link to a photo or logo for this vendor.">
          <Input id="vphoto" value={input.logoUrl} onChange={(e) => set("logoUrl", e.target.value)}
            placeholder="https://…/photo.jpg" inputMode="url" />
        </Field>
        <Field label="Pricing tier" htmlFor="vprice" hint="Set by the vendor once they've claimed their profile.">
          <Select
            value={input.pricingTier}
            onValueChange={(v) => set("pricingTier", v)}
            items={[{ value: "", label: "No pricing indicator" }, ...PRICING_TIERS]}
          >
            <SelectTrigger id="vprice"><SelectValue placeholder="Select tier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">No pricing indicator</SelectItem>
              {PRICING_TIERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Separator />
      <p className="text-sm font-medium text-heading">Contact information</p>
      {/* Website URL — shown first as the primary reference link */}
      <Field label="Website URL" htmlFor="vw"
        hint="The vendor's primary website or portfolio. Shown prominently on their record.">
        <Input id="vw" value={input.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)}
          placeholder="https://vendor.com" inputMode="url" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name" htmlFor="vcn">
          <Input id="vcn" value={input.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="Jane Bloom" />
        </Field>
        <Field label="Phone" htmlFor="vph">
          <Input id="vph" type="tel" value={input.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(615) 555-1234" />
        </Field>
        <Field label="Email" htmlFor="vem" error={errors.email}>
          <Input id="vem" type="email" value={input.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@vendor.com" />
        </Field>
      </div>

      <Separator />
      <p className="text-sm font-medium text-heading">
        Social media <span className="font-normal text-muted-foreground">(optional)</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Instagram" htmlFor="vig">
          <Input id="vig" value={input.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} placeholder="instagram.com/vendor or @vendor" />
        </Field>
        <Field label="Facebook" htmlFor="vfb">
          <Input id="vfb" value={input.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} placeholder="facebook.com/vendor" />
        </Field>
        <Field label="Pinterest" htmlFor="vpin">
          <Input id="vpin" value={input.pinterestUrl} onChange={(e) => set("pinterestUrl", e.target.value)} placeholder="pinterest.com/vendor" />
        </Field>
        <Field label="TikTok" htmlFor="vtt">
          <Input id="vtt" value={input.tiktokUrl} onChange={(e) => set("tiktokUrl", e.target.value)} placeholder="tiktok.com/@vendor" />
        </Field>
      </div>
      </fieldset>

      <Separator />
      <p className="text-sm font-medium text-heading">Your relationship with this vendor</p>
      <Field label="Recommendation level" htmlFor="vpref"
        hint="Controls how prominently this vendor appears to clients in their portal.">
        <Select
          value={input.preferenceLevel}
          onValueChange={(v) => set("preferenceLevel", v as VendorInput["preferenceLevel"])}
          items={PREFERENCE_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
        >
          <SelectTrigger id="vpref"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PREFERENCE_LEVELS.map(l => (
              <SelectItem key={l.value} value={l.value}>
                <span className="font-medium">{l.label}</span>
                <span className="text-muted-foreground ml-2 text-xs hidden sm:inline">— {l.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Special pricing or promotion" htmlFor="vspecial"
        hint="A discount or arrangement specific to your venue — not shown to clients.">
        <Input id="vspecial" value={input.specialPricingNote} onChange={(e) => set("specialPricingNote", e.target.value)}
          placeholder="10% off for repeat bookings…" />
      </Field>
      <Field label="Internal notes" htmlFor="vnotes"
        hint="Arrival preferences, setup requirements, past experiences. Not visible to vendors.">
        <Textarea id="vnotes" value={input.notes} rows={3} onChange={(e) => set("notes", e.target.value)}
          placeholder="Delivers 2 hours before ceremony, requires a shaded prep area…" />
      </Field>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={onSubmit} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function VendorForm() {
  const router = useRouter();
  const [input, setInput] = React.useState<VendorInput>(() => createInitialVendorInput());
  const [errors, setErrors] = React.useState<VendorErrors>({});
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof VendorInput>(key: K, v: VendorInput[K]) => {
    setInput((p) => ({ ...p, [key]: v }));
    setErrors((p) => { const n = { ...p }; delete n[key as string]; return n; });
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = await createVendorAction(input);
      if (result.ok) { toast.success("Vendor added."); router.push(`/vendors/${result.vendorId}`); return; }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return <VendorFormFields input={input} errors={errors} set={set} onSubmit={handleSubmit} pending={pending} />;
}
