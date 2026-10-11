import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { getVendorUser } from "@/lib/vendor-auth/service";

export const metadata: Metadata = { title: "Change password — Vendor" };

/**
 * Signed-in vendor password change. Linked from the vendor workspace shell.
 */
export default async function VendorChangePasswordPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/vendor/login");

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl font-medium text-heading">Change password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password for your vendor sign-in. You’ll stay signed in after it updates.
        </p>
      </div>
      <ChangePasswordForm audience="vendor" />
    </div>
  );
}
