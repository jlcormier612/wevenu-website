import type { Metadata } from "next";

import { AuthBrandShell } from "@/components/auth/auth-brand-shell";
import { AuthConfirmClient } from "@/components/auth/auth-confirm-client";

export const metadata: Metadata = {
  title: "Confirming reset link",
};

/**
 * Browser-visible Auth callback. Recovery tokens often arrive in the URL hash
 * (not visible to Route Handlers), so confirmation runs client-side.
 */
export default function AuthConfirmPage() {
  return (
    <AuthBrandShell
      title="Confirming your link"
      description="One moment while we verify your password reset request."
    >
      <AuthConfirmClient />
    </AuthBrandShell>
  );
}
