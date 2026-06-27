"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createPackageAction, updatePackageAction } from "@/app/(app)/packages/actions";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_PACKAGE_INPUT, PACKAGE_CATEGORIES } from "@/lib/packages/constants";
import type { Package, PackageErrors, PackageInput } from "@/lib/packages/types";

export function PackageForm({ existing }: { existing?: Package }) {
  const router = useRouter();
  const [input, setInput] = React.useState<PackageInput>(
    existing
      ? { name: existing.name, description: existing.description ?? "", basePrice: String(existing.basePrice), category: existing.category ?? "", isActive: existing.isActive }
      : EMPTY_PACKAGE_INPUT,
  );
  const [errors, setErrors] = React.useState<PackageErrors>({});
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof PackageInput>(k: K, v: PackageInput[K]) => {
    setInput((p) => ({ ...p, [k]: v }));
    setErrors((p) => { const n = { ...p }; delete n[k as string]; return n; });
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = existing
        ? await updatePackageAction(existing.id, input)
        : await createPackageAction(input);
      if (result.ok) {
        toast.success(existing ? "Package updated." : "Package created.");
        router.push("/packages");
        router.refresh();
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-5">
      <Field label="Package name" htmlFor="pn" required error={errors.name}>
        <Input id="pn" value={input.name} onChange={(e) => set("name", e.target.value)}
          placeholder="Silver Package, Garden Ceremony, Full-Day Rental…" autoFocus aria-invalid={errors.name ? true : undefined} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Base price" htmlFor="pp" required error={errors.basePrice}>
          <Input id="pp" value={input.basePrice} onChange={(e) => set("basePrice", e.target.value)}
            placeholder="8,500" aria-invalid={errors.basePrice ? true : undefined} />
        </Field>
        <Field label="Category" htmlFor="pc">
          <Select value={input.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger id="pc"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {PACKAGE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Description" htmlFor="pd" hint="Visible on invoices. What does this package include?">
        <Textarea id="pd" value={input.description} onChange={(e) => set("description", e.target.value)}
          placeholder="Describe what's included in this package…" rows={3} />
      </Field>

      <div className="flex items-center gap-3">
        <Switch checked={input.isActive} onCheckedChange={(v) => set("isActive", v)} />
        <Label className="cursor-pointer text-sm">Active — available for selection on invoices</Label>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : existing ? "Save changes" : "Create Package"}
        </Button>
      </div>
    </div>
  );
}
