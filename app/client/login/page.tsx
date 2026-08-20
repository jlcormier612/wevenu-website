import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClientLoginForm } from "@/app/client/login/login-form";
import { Wordmark } from "@/components/brand/wordmark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClientPortalAuthClient } from "@/integrations/supabase/server";
import { getMyPortalUrl } from "@/lib/client-auth/service";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign In — Hello to Cheers" };

export const dynamic = "force-dynamic";

/**
 * Couple / client portal login. Uses the client auth cookie jar so a venue
 * session in the same browser stays intact.
 */
export default async function ClientLoginPage() {
  if (isSupabaseConfigured) {
    const portalUrl = await getMyPortalUrl();
    if (portalUrl) redirect(portalUrl);
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Sign in to your planning workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
      </div>
    </main>
  );
}
