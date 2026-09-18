import type { Metadata } from "next";
import type { CSSProperties } from "react";
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

/** Always-light brand surface — same contract as venue login. */
const LIGHT_THEME_VARS = {
  "--background": "var(--true-white)",
  "--foreground": "var(--black)",
  "--card": "var(--true-white)",
  "--card-foreground": "var(--black)",
  "--popover": "var(--true-white)",
  "--popover-foreground": "var(--black)",
  "--heading": "var(--forest-sage)",
  "--muted": "var(--natural-cream)",
  "--muted-foreground":
    "color-mix(in oklch, var(--forest-sage) 80%, transparent)",
  "--secondary": "var(--natural-cream)",
  "--secondary-foreground": "var(--forest-sage)",
  "--primary": "var(--heritage-sage)",
  "--primary-foreground": "var(--true-white)",
  "--accent": "var(--soft-sage)",
  "--accent-foreground": "var(--forest-sage)",
  "--border": "var(--taupe-light)",
  "--input": "var(--taupe-light)",
  "--ring": "var(--heritage-sage)",
} as CSSProperties;

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
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (vu) redirect(next.startsWith("/vendor") ? next : "/vendor/dashboard");
      if (next.startsWith("/vendor/accept")) redirect(next);
    }
  }

  return (
    <main
      data-theme-lock="light"
      className="flex min-h-svh flex-col items-center justify-center px-4 py-12"
      style={{
        background:
          "color-mix(in oklch, var(--linen), var(--taupe-dark) 45%)",
        ...LIGHT_THEME_VARS,
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Wordmark forceLight />
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
