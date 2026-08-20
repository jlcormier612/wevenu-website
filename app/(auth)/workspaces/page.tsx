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
import { loadActivePortalSessions } from "@/lib/auth/resolve-home";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Choose a workspace",
};

export const dynamic = "force-dynamic";

/**
 * Lists every portal session currently active in this browser (separate cookie
 * jars for venue, vendor, and client). Prefer this over signing out when you
 * already inhabit more than one experience.
 */
export default async function WorkspacesPage() {
  if (!isSupabaseConfigured) redirect("/login");

  const sessions = await loadActivePortalSessions();
  const options: { href: string; title: string; description: string; email: string | null }[] = [];

  if (sessions.venue?.roles.isVenueStaff) {
    options.push({
      href: "/dashboard",
      title: "Venue workspace",
      description: "Leads, events, planning, and Setup Hub for your venue.",
      email: sessions.venue.email,
    });
  }
  if (sessions.vendor?.roles.isVendor) {
    options.push({
      href: "/vendor/dashboard",
      title: "Vendor portal",
      description: "Your business profile, venue relationships, and event work.",
      email: sessions.vendor.email,
    });
  }
  if (sessions.client?.roles.clientPortalPath) {
    options.push({
      href: sessions.client.roles.clientPortalPath,
      title: "Client planning space",
      description: "Your couple portal for this celebration.",
      email: sessions.client.email,
    });
  }

  if (options.length === 0) {
    redirect("/login");
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
              This browser has more than one Hello to Cheers session active.
              Each portal keeps its own sign-in — switching here does not sign
              the others out.
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
                {opt.email ? (
                  <p className="text-[11px] text-muted-foreground mt-1">{opt.email}</p>
                ) : null}
              </Link>
            ))}
            <p className="text-center text-xs text-muted-foreground pt-2">
              Sign out from inside a portal only ends that portal&apos;s session.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
