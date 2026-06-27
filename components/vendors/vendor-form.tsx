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
  VENDOR_CATEGORIES,
  createInitialVendorInput,
} from "@/lib/vendors/constants";
import type { VendorErrors, VendorInput } from "@/lib/vendors/types";

export function VendorFormFields({
  input, errors, set, onSubmit, pending, submitLabel = "Save vendor",
}: {
  input: VendorInput;
  errors: VendorErrors;
  set: <K extends keyof VendorInput>(key: K, v: VendorInput[K]) => void;
  onSubmit: () => void;
  pending: boolean;
  submitLabel?: string;
}) {
  const router = useRouter();
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vendor name" htmlFor="vn" required error={errors.name}>
          <Input id="vn" value={input.name} onChange={(e) => set("name", e.target.value)}
            placeholder="Blossoms Floral Studio" aria-invalid={errors.name ? true : undefined} />
        </Field>
        <Field label="Category" htmlFor="vc">
          <Select value={input.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger id="vc"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {VENDOR_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <Switch
          checked={input.isPreferred}
          onCheckedChange={(c) => set("isPreferred", c)}
          id="vp"
        />
        <Label htmlFor="vp" className="cursor-pointer">
          Preferred vendor
          <span className="block text-xs font-normal text-muted-foreground mt-0.5">
            Preferred vendors appear first in event assignment selects.
          </span>
        </Label>
      </div>

      <Separator />
      <p className="text-sm font-medium text-heading">Contact information</p>
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
        <Field label="Website" htmlFor="vw">
          <Input id="vw" value={input.website} onChange={(e) => set("website", e.target.value)} placeholder="vendor.com" />
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

      <Separator />
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
