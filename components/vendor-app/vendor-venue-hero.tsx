"use client";

/**
 * VendorVenueHero — Venue-First Vendor Dashboard (2026-07-24).
 *
 * "Remove the 'Venue Partnerships' page as the primary destination...
 * the vendor dashboard should immediately immerse the vendor in that
 * venue." Same design language as the Couple Workspace's own hero:
 * venue photo, venue branding, partnership status, contacts, current
 * promotion — all above the "what needs my attention" cards.
 *
 * "If a vendor later has multiple venue relationships, introduce a
 * lightweight venue switcher rather than making the entire dashboard a
 * list of venue cards." A dropdown only appears once partnerships.length
 * > 1; the common single-venue case never sees a picker at all.
 *
 * Richer partnership dashboard (2026-07-24, second pass): "Without adding
 * complexity, it immediately answers: Who am I working with? Who do I
 * contact? What's happening next?" The Contacts/Promotion two-column grid
 * became a three-column one (Venue Contact / Current Promotion / Next
 * Event) rather than a fourth separate block — same amount of visual
 * real estate, one more answer. "{Category} Partner" reads directly off
 * the vendor's own business category, not new data.
 */

import * as React from "react";
import Link from "next/link";

import { PromotionEditor } from "@/components/vendor-app/vendor-partnerships-list";
import { getVendorActiveVenueAction } from "@/app/vendor/actions";
import { formatEventDateRangeShort } from "@/lib/events/constants";
import { vendorCategoryLabel } from "@/lib/vendors/constants";
import type { VendorActiveVenueContext, VendorEventListItem, VendorPartnership } from "@/lib/vendors/types";

const PREFERENCE_LABELS: Record<string, string> = {
  featured: "⭐ Featured Partner",
  preferred: "⭐ Preferred Vendor",
  recommended: "Recommended Vendor",
};

function formatPartnerSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function initials(name: string): string {
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

export function VendorVenueHero({ initialVenue, partnerships, vendorCategory, allEvents }: {
  initialVenue: VendorActiveVenueContext;
  partnerships: VendorPartnership[];
  vendorCategory: string | null;
  allEvents: VendorEventListItem[];
}) {
  const [context, setContext] = React.useState(initialVenue);
  const [switching, setSwitching] = React.useState(false);

  async function switchVenue(venueId: string) {
    setSwitching(true);
    try {
      const next = await getVendorActiveVenueAction(venueId);
      if (next) setContext(next);
    } finally {
      setSwitching(false);
    }
  }

  if (!context) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-10 text-center">
        <p className="text-sm font-medium text-foreground">No venue partnership yet</p>
        <p className="text-xs text-muted-foreground mt-1">Once a venue adds you to their preferred vendor list, you&apos;ll see them here.</p>
      </div>
    );
  }

  const { venue, partnership, contacts } = context;
  const categoryLabel = vendorCategoryLabel(vendorCategory);
  const primaryContact = contacts[0] ?? null;

  const upcomingAtVenue = allEvents
    .filter((e) => e.venueId === venue.id && e.isUpcoming && e.eventDate)
    .sort((a, b) => (a.eventDate! < b.eventDate! ? -1 : 1));
  const nextEvent = upcomingAtVenue[0] ?? null;

  return (
    <div className="space-y-3">

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden relative" style={{
        background: venue.heroImageUrl
          ? `url(${venue.heroImageUrl}) center/cover no-repeat`
          : `linear-gradient(155deg, ${venue.secondaryColor ?? "#4F5F4F"} 0%, ${venue.primaryColor ?? "#5D6F5D"} 100%)`,
        minHeight: 220,
      }}>
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.38) 45%, rgba(0,0,0,0.05) 100%)",
        }} />
        <div className="relative flex flex-col justify-end gap-2 p-6" style={{ minHeight: 220 }}>
          <div className="flex items-center gap-2.5">
            {venue.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={venue.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover border border-white/40 shrink-0" />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Partnering with</span>
          </div>
          <p className="text-3xl font-bold text-white leading-tight">{venue.name}</p>
          {categoryLabel && (
            <p className="text-sm font-medium text-white/85">{categoryLabel} Partner</p>
          )}
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {PREFERENCE_LABELS[partnership.preferenceLevel] && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/15 text-white backdrop-blur">
                {PREFERENCE_LABELS[partnership.preferenceLevel]}
              </span>
            )}
            <span className="text-xs text-white/70">Partner since {formatPartnerSince(partnership.addedAt)}</span>
            {partnership.activeEventCount > 0 && (
              <span className="text-xs text-white/70">· {partnership.activeEventCount} event{partnership.activeEventCount === 1 ? "" : "s"} together</span>
            )}
          </div>
        </div>
      </div>

      {/* Lightweight venue switcher — only for vendors with more than one relationship */}
      {partnerships.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Viewing:</span>
          <select
            value={venue.id}
            disabled={switching}
            onChange={(e) => switchVenue(e.target.value)}
            className="text-xs rounded-lg border border-border px-2 py-1.5 bg-background disabled:opacity-50"
          >
            {partnerships.map((p) => <option key={p.venueId} value={p.venueId}>{p.venueName}</option>)}
          </select>
          <Link href="/vendor/partnerships" className="text-xs text-primary hover:underline ml-auto">All partnerships →</Link>
        </div>
      )}

      {/* Who do I contact? / What's happening? / What's next? — one glance,
          three columns, same footprint as the old two-column grid. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-3">👋 Venue Contact</p>
          {!primaryContact ? (
            <p className="text-xs text-muted-foreground">No contacts listed yet.</p>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                  {initials(primaryContact.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{primaryContact.fullName}</p>
                  <p className="text-[10px] text-muted-foreground">{primaryContact.title || primaryContact.role}</p>
                </div>
                {primaryContact.email && (
                  <a href={`mailto:${primaryContact.email}`} className="text-[10px] text-primary hover:underline shrink-0">Email</a>
                )}
              </div>
              {contacts.length > 1 && (
                <p className="text-[10px] text-muted-foreground">+{contacts.length - 1} more contact{contacts.length - 1 === 1 ? "" : "s"}</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground">🎁 Current Promotion</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">What couples see on your profile at {venue.name}.</p>
          <PromotionEditor partnership={partnership} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-3">📅 Next Event</p>
          {!nextEvent ? (
            <p className="text-xs text-muted-foreground">Nothing booked here yet.</p>
          ) : (
            <>
              <Link href={`/vendor/events/${nextEvent.assignmentId}`} className="text-xs font-medium text-foreground hover:text-primary">
                {nextEvent.eventName}
              </Link>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatEventDateRangeShort(nextEvent.eventDate!, nextEvent.eventEndDate)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2">
                {upcomingAtVenue.length} upcoming event{upcomingAtVenue.length === 1 ? "" : "s"} together
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
