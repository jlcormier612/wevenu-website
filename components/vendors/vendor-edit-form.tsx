"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateVendorAction } from "@/app/(app)/vendors/[id]/actions";
import { VendorFormFields } from "@/components/vendors/vendor-form";
import { createInitialVendorInput } from "@/lib/vendors/constants";
import type { Vendor, VendorErrors, VendorInput } from "@/lib/vendors/types";

export function VendorEditForm({ vendor }: { vendor: Vendor }) {
  const router = useRouter();
  const [input, setInput] = React.useState<VendorInput>(() => createInitialVendorInput(vendor));
  const [errors, setErrors] = React.useState<VendorErrors>({});
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof VendorInput>(key: K, v: VendorInput[K]) => {
    setInput((p) => ({ ...p, [key]: v }));
    setErrors((p) => { const n = { ...p }; delete n[key as string]; return n; });
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateVendorAction(vendor.id, input);
      if (result.ok) { toast.success("Vendor updated."); router.push(`/vendors/${vendor.id}`); router.refresh(); return; }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return <VendorFormFields input={input} errors={errors} set={set} onSubmit={handleSubmit} pending={pending} submitLabel="Save changes" />;
}
