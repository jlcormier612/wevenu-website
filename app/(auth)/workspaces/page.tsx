import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/wordmark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/integrations/supabase/server";
import { loadPortalRoles } from "@/lib/auth/resolve-home";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Choose a workspace",
};

export const dynamic = "force-dynamic";

/**
 * Shown when one Hello to Cheers login is linked to more than one portal
 * (venue staff, vendor, and/or client). One browser session = one auth
 * identity; this page is the explicit switch — not three parallel logins.
 */
export default async function WorkspacesPage() {
  if (!isSupabaseConfigured) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const roles = await loadPortalRoles(supabase, user.id);
  const options: { href: string; title: string; description: string }[] = [];

  if (roles.isVenueStaff) {
    options.push({
      href: "/dashboard",
      title: "Venue workspace",
      description: "Leads, events, planning, and Setup Hub for your venue.",
    });
  }
  if (roles.isVendor) {
    options.push({
      href: "/vendor/dashboard",
      title: "Vendor portal",
      description: "Your business profile, venue relationships, and event work.",
    });
  }
  if (roles.clientPortalPath) {
    options.push({
      href: roles.clientPortalPath,
      title: "Client planning space",
      description: "Your couple portal for this celebration.",
    });
  }

  if (options.length === 0) {
    redirect("/setup");
  }
  if (options.length === 1) {
    redirect(options[0]!.href);
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        <Card>
          <CardHeader className="text-center space-y-2">
            <CardTitle>Choose a workspace</CardTitle>
            <CardDescription>
              You&apos;re signed in as {user.email}. This account is linked to more
              than one Hello to Cheers experience — pick where to go.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {options.map((opt) => (
              <Link
                key={opt.href}
                href={opt.href}
                className="block rounded-lg border border-border bg-background px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-semibold text-foreground">{opt.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </Link>
            ))}
            <p className="text-center text-xs text-muted-foreground pt-2">
              To use a different email for another role, sign out first.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
