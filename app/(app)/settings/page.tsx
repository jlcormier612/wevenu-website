import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  CreditCard,
  Inbox,
  MessageCircle,
  UsersRound,
} from "lucide-react";

import { PageHeader } from "@/components/shell/module-placeholder";
import { getCurrentVenue } from "@/lib/venue/service";
import { getQuickBooksConnection } from "@/lib/quickbooks/service";
import { getTourAvailability } from "@/lib/tours/service";
import { listLegalAcceptancesForCurrentUser } from "@/lib/legal/service";

export const metadata: Metadata = { title: "Settings" };

type SettingsCategory = {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  summary?: string;
};

/**
 * Settings home — the navigation layer. Each category below is a real,
 * independently-routed settings area (app/(app)/settings/<slug>), not an
 * accordion on this page. See docs from the Settings IA restructure for
 * what moved where.
 */
export default async function SettingsPage() {
  const [venue, quickbooksConnection, tourAvailability, legalHistory] = await Promise.all([
    getCurrentVenue(), getQuickBooksConnection(), getTourAvailability(), listLegalAcceptancesForCurrentUser(),
  ]);

  const blockedDateCount = tourAvailability.ok ? tourAvailability.exceptions.length : null;
  const paymentsConnected = Boolean(venue?.stripeAccountId);
  const quickbooksConnected = quickbooksConnection?.status === "connected";

  const categories: SettingsCategory[] = [
    {
      href: "/settings/business",
      title: "Business & Brand",
      icon: Building2,
      description: "Your venue information, appearance, and public-facing details.",
    },
    {
      href: "/settings/leads",
      title: "Leads & Booking",
      icon: Inbox,
      description: "Inquiry forms, lead sources, and tour booking.",
    },
    {
      href: "/settings/availability",
      title: "Availability & Capacity",
      icon: CalendarClock,
      description: "Tour hours, blocked dates, spaces, and operating limits.",
      summary: blockedDateCount == null
        ? undefined
        : `${blockedDateCount} blocked date${blockedDateCount === 1 ? "" : "s"}`,
    },
    {
      href: "/settings/communications",
      title: "Communications & Automation",
      icon: MessageCircle,
      description: "Notifications, follow-ups, and Luv.",
    },
    {
      href: "/settings/integrations",
      title: "Financials & Integrations",
      icon: CreditCard,
      description: "Payments, accounting, and connected services.",
      summary: `${paymentsConnected ? "Payments connected" : "Payments not connected"} · ${quickbooksConnected ? "QuickBooks connected" : "QuickBooks not connected"}`,
    },
    {
      href: "/settings/team",
      title: "Team & Data",
      icon: UsersRound,
      description: "Manage your team, permissions, imports, and venue data.",
    },
  ];

  const mostRecentAcceptance = legalHistory.length > 0
    ? legalHistory.reduce((latest, item) => (item.acceptedAt > latest.acceptedAt ? item : latest))
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Make Hello to Cheers work the way your venue works."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            className="flex flex-col gap-3 rounded-sm border border-border bg-card p-5 transition-colors hover:bg-muted/20"
          >
            <div className="flex size-9 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <cat.icon className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-heading">{cat.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
              {cat.summary && (
                <p className="mt-2 text-[11px] text-muted-foreground/80">{cat.summary}</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Legal acceptance stays on record and reachable, without being
          presented as a business-configuration task — see the Settings IA
          restructure notes on why Legal History no longer has a prominent
          section here. */}
      <p className="text-xs text-muted-foreground">
        Account &amp; legal
        {mostRecentAcceptance && (
          <> · Terms accepted {new Date(mostRecentAcceptance.acceptedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
        )}
        {" · "}
        <Link href="/legal/privacy_policy" className="hover:underline">Privacy</Link>
        {" · "}
        <Link href="/legal/cookie_policy" className="hover:underline">Cookies</Link>
      </p>
    </div>
  );
}
