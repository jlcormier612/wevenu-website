import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { VendorLoginForm } from "@/app/vendor/login/login-form";
import { Wordmark } from "@/components/brand/wordmark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createVendorClient } from "@/integrations/supabase/server";
import { safeInternalNextPath } from "@/lib/auth/portal-home";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Vendor sign in — Hello to Cheers" };

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string }> };

/**
 * Vendor-only login. Uses the vendor auth cookie jar so a venue session in the
 * same browser stays signed in.
 */
export default async function VendorLoginPage({ searchParams }: Props) {
  const { next: nextRaw } = await searchParams;
  const next = safeInternalNextPath(nextRaw) ?? "/vendor/dashboard";

  if (isSupabaseConfigured) {
    const supabase = await createVendorClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: vu } = await supabase
        .from("vendor_users")
        .select("vendor_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (vu) redirect(next.startsWith("/vendor") ? next : "/vendor/dashboard");
      if (next.startsWith("/vendor/accept")) redirect(next);
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        <Card>
          <CardHeader className="text-center space-y-1">
            <CardTitle>Vendor sign in</CardTitle>
            <CardDescription>
              Sign in to your vendor portal. This does not replace a venue or
              client session in this browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <VendorLoginForm next={next} />
            <p className="text-center text-xs text-muted-foreground">
              Venue staff?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Venue sign in
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
