import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClientLoginForm } from "@/app/client/login/login-form";
import { AuthBrandFrame } from "@/components/auth/auth-brand-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMyPortalUrl } from "@/lib/client-auth/service";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign In — Hello to Cheers" };

export const dynamic = "force-dynamic";

/**
 * Couple / client portal login. Uses the client auth cookie jar so a venue
 * session in the same browser stays intact.
 */
type Props = {
  searchParams: Promise<{ reset?: string }>;
};

export default async function ClientLoginPage({ searchParams }: Props) {
  const { reset } = await searchParams;
  const justReset = reset === "1";

  if (isSupabaseConfigured) {
    const portalUrl = await getMyPortalUrl();
    if (portalUrl) redirect(portalUrl);
  }

  return (
    <AuthBrandFrame>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Sign in to your planning workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {justReset ? (
            <p
              role="status"
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground"
            >
              Your password was updated. Sign in with your new password.
            </p>
          ) : null}
          <ClientLoginForm />
          <p className="text-center text-xs text-muted-foreground">
            Venue staff?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Venue sign in
            </Link>
            {" · "}
            Vendors?{" "}
            <Link href="/vendor/login" className="text-primary hover:underline">
              Vendor sign in
            </Link>
            {" · "}
            <Link href="/workspaces" className="text-primary hover:underline">
              Switch workspace
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthBrandFrame>
  );
}
