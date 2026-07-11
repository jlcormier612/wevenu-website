"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { uploadToStorage } from "@/lib/storage/upload";
import { PRICING_TIERS, VENDOR_CATEGORIES } from "@/lib/vendors/constants";
import type { VendorProfile, VendorProfileInput } from "@/lib/vendors/types";
import { updateVendorProfileAction } from "@/app/vendor/actions";

function buildInput(profile: VendorProfile): VendorProfileInput {
  return {
    businessName:        profile.businessName,
    category:            profile.category ?? "",
    description:         profile.description ?? "",
    contactName:         profile.contactName ?? "",
    email:               profile.email ?? "",
    phone:               profile.phone ?? "",
    websiteUrl:          profile.websiteUrl ?? "",
    instagramUrl:        profile.instagramUrl ?? "",
    facebookUrl:         profile.facebookUrl ?? "",
    pinterestUrl:        profile.pinterestUrl ?? "",
    tiktokUrl:           profile.tiktokUrl ?? "",
    logoUrl:             profile.logoUrl ?? "",
    serviceArea:         profile.serviceArea ?? "",
    pricingTier:         profile.pricingTier ?? "",
    insuranceExpiry:     profile.insuranceExpiry ?? "",
    isMarketplaceListed: profile.isMarketplaceListed,
    acceptingInquiries:  profile.acceptingInquiries,
    availabilityNotes:   profile.availabilityNotes ?? "",
  };
}

export function VendorProfileForm({ profile }: { profile: VendorProfile }) {
  const [input, setInput] = React.useState<VendorProfileInput>(() => buildInput(profile));
  const [pending, startTransition] = React.useTransition();
  const [uploading, setUploading] = React.useState(false);

  const set = <K extends keyof VendorProfileInput>(key: K, v: VendorProfileInput[K]) =>
    setInput((p) => ({ ...p, [key]: v }));

  async function handleLogoUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadToStorage("vendors", `${profile.id}/logo`, file);
      set("logoUrl", url);
    } catch {
      toast.error("Logo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateVendorProfileAction(input);
      if (result.ok) toast.success("Profile saved.");
      else toast.error("errors" in result && result.errors
        ? Object.values(result.errors)[0]
        : (result.message ?? "Could not save profile."));
    });
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-6">
      {/* Logo */}
      <div className="flex items-center gap-4">
        {input.logoUrl ? (
          <img src={input.logoUrl} alt="Logo" className="h-16 w-16 rounded-xl object-cover border border-border" />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground border border-border">
            {profile.businessName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground cursor-pointer hover:text-primary">
            {uploading ? "Uploading…" : "Change logo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
            />
          </label>
          <p className="text-xs text-muted-foreground">PNG, JPG or WebP</p>
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" htmlFor="pf-biz" required>
          <Input id="pf-biz" value={input.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </Field>
        <Field label="Category" htmlFor="pf-cat">
          <Select value={input.category} onValueChange={(v) => set("category", v)} items={VENDOR_CATEGORIES}>
            <SelectTrigger id="pf-cat"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {VENDOR_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Description" htmlFor="pf-desc" hint="Shown to venues and couples browsing your profile.">
        <Textarea id="pf-desc" rows={3} value={input.description} onChange={(e) => set("description", e.target.value)}
          placeholder="Tell venues about your style, experience, and what makes you stand out…" />
      </Field>

      <Separator />
      <p className="text-sm font-medium text-heading">Contact</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name" htmlFor="pf-cn">
          <Input id="pf-cn" value={input.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="pf-em">
          <Input id="pf-em" type="email" value={input.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor="pf-ph">
          <Input id="pf-ph" type="tel" value={input.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Website" htmlFor="pf-web">
          <Input id="pf-web" value={input.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://yourbusiness.com" />
        </Field>
      </div>

      <Separator />
      <p className="text-sm font-medium text-heading">Social media <span className="font-normal text-muted-foreground">(optional)</span></p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Instagram" htmlFor="pf-ig">
          <Input id="pf-ig" value={input.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} placeholder="instagram.com/you or @you" />
        </Field>
        <Field label="Facebook" htmlFor="pf-fb">
          <Input id="pf-fb" value={input.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} placeholder="facebook.com/you" />
        </Field>
        <Field label="Pinterest" htmlFor="pf-pin">
          <Input id="pf-pin" value={input.pinterestUrl} onChange={(e) => set("pinterestUrl", e.target.value)} />
        </Field>
        <Field label="TikTok" htmlFor="pf-tt">
          <Input id="pf-tt" value={input.tiktokUrl} onChange={(e) => set("tiktokUrl", e.target.value)} />
        </Field>
      </div>

      <Separator />
      <p className="text-sm font-medium text-heading">Business details</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service area" htmlFor="pf-area" hint="e.g. Nashville, TN · 50 mile radius">
          <Input id="pf-area" value={input.serviceArea} onChange={(e) => set("serviceArea", e.target.value)} />
        </Field>
        <Field label="Pricing tier" htmlFor="pf-price">
          <Select
            value={input.pricingTier}
            onValueChange={(v) => set("pricingTier", v)}
            items={[{ value: "", label: "No indicator" }, ...PRICING_TIERS]}
          >
            <SelectTrigger id="pf-price"><SelectValue placeholder="Select tier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">No indicator</SelectItem>
              {PRICING_TIERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Insurance expiration" htmlFor="pf-ins" hint="Venues may ask for this.">
          <Input id="pf-ins" type="date" value={input.insuranceExpiry} onChange={(e) => set("insuranceExpiry", e.target.value)} />
        </Field>
      </div>

      <Separator />
      <p className="text-sm font-medium text-heading">Visibility</p>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Marketplace listing</p>
            <p className="text-xs text-muted-foreground">Allow venues to discover you in the vendor marketplace.</p>
          </div>
          <Switch checked={input.isMarketplaceListed} onCheckedChange={(v) => set("isMarketplaceListed", v)} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Accepting inquiries</p>
            <p className="text-xs text-muted-foreground">Venues can send you booking inquiries.</p>
          </div>
          <Switch checked={input.acceptingInquiries} onCheckedChange={(v) => set("acceptingInquiries", v)} />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={handleSubmit} disabled={pending || uploading}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
