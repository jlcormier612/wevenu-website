import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { PageHeader } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Change password" };

/**
 * Signed-in venue staff password change. Reachable from the account menu.
 */
export default function ChangePasswordPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Change password"
        description="Choose a new password for your Hello to Cheers sign-in. You’ll stay signed in after it updates."
      />
      <ChangePasswordForm />
    </div>
  );
}
