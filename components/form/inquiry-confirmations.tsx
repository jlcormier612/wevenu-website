"use client";

import * as React from "react";

import { HtcPlatformMark } from "@/components/brand/htc-platform-mark";
import type { TourBookingConfirmation } from "@/lib/inquiry-form/types";
import { publicFormSurfaceStyle, readableInk } from "@/lib/theme/public-form-surface";
import { formatVenueLocalTourDisplay } from "@/lib/venue/timezone";

type FormBrand = {
  primary: string;
  secondary?: string;
  accent?: string;
  neutral?: string;
};

function buildAddressLine(
  addressLine1?: string | null,
  city?: string | null,
  stateRegion?: string | null,
): string {
  const cityState = [city, stateRegion].filter(Boolean).join(", ");
  return [addressLine1, cityState].filter(Boolean).join(", ");
}

function buildGoogleCalendarUrl(
  scheduledAt: string,
  duration: number,
  venueName: string,
  address?: string | null,
): string {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + duration * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Tour at ${venueName}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Your ${duration}-minute venue tour at ${venueName}.`,
  });
  if (address) params.set("location", address);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildIcsDataUrl(
  scheduledAt: string,
  duration: number,
  venueName: string,
  address?: string | null,
): string {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + duration * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
  const uid = `tour-${Date.now()}@${venueName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "venue"}.invalid`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hello to Cheers//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}Z`,
    `DTSTART:${fmt(start)}Z`,
    `DTEND:${fmt(end)}Z`,
    `SUMMARY:Tour at ${venueName}`,
    address ? `LOCATION:${address}` : null,
    `DESCRIPTION:Your ${duration}-minute venue tour at ${venueName}.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function RequestInformationConfirmation({
  firstName,
  venueName,
  brand,
  /** @deprecated Prefer `brand.primary` — kept for callers mid-migration. */
  primaryColor,
}: {
  firstName: string;
  venueName: string;
  brand?: FormBrand;
  primaryColor?: string;
}) {
  const surface = brand ?? { primary: primaryColor || "#5D6F5D" };
  const heading = firstName.trim() ? `Thank you, ${firstName.trim()}!` : "Thank you!";
  return (
    <div data-theme-lock="light" className="min-h-screen flex items-center justify-center px-4" style={publicFormSurfaceStyle(surface)}>
      <div className="max-w-md w-full bg-card text-card-foreground rounded-2xl shadow-sm border border-border p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold text-heading">{heading}</h2>
        <p className="text-foreground">We&apos;ve received your inquiry for {venueName}.</p>
        <p className="text-foreground">We&apos;ll be in touch soon.</p>
        <HtcPlatformMark className="pt-2" />
      </div>
    </div>
  );
}

export function ScheduleTourConfirmation({
  firstName,
  confirmation,
  brand,
  primaryColor,
}: {
  firstName: string;
  confirmation: TourBookingConfirmation;
  brand?: FormBrand;
  primaryColor?: string;
}) {
  const surface = brand ?? { primary: primaryColor || "#5D6F5D" };
  const primary = surface.primary;
  const heading = firstName.trim() ? `You're booked, ${firstName.trim()}!` : "You're booked!";
  const { dateLabel, timeLabel } = formatVenueLocalTourDisplay(
    confirmation.scheduledAt,
    confirmation.timezone,
  );
  const addressLine = buildAddressLine(
    confirmation.addressLine1,
    confirmation.city,
    confirmation.stateRegion,
  );
  const gcalUrl = buildGoogleCalendarUrl(
    confirmation.scheduledAt,
    confirmation.duration,
    confirmation.venueName,
    addressLine || null,
  );
  const icsUrl = buildIcsDataUrl(
    confirmation.scheduledAt,
    confirmation.duration,
    confirmation.venueName,
    addressLine || null,
  );

  return (
    <div data-theme-lock="light" className="min-h-screen flex items-center justify-center px-4" style={publicFormSurfaceStyle(surface)}>
      <div className="max-w-md w-full bg-card text-card-foreground rounded-2xl shadow-sm border border-border p-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-heading">{heading}</h2>
          <p className="text-foreground">We&apos;re looking forward to meeting you at {confirmation.venueName}.</p>
        </div>

        <div className="rounded-lg border border-border bg-muted p-5 space-y-3 text-left">
          <p className="text-sm font-semibold text-heading">Your tour</p>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Date</p>
            <p className="text-sm text-heading">{dateLabel}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Time</p>
            <p className="text-sm text-heading">{timeLabel}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Location</p>
            <p className="text-sm text-heading">{confirmation.venueName}</p>
            {addressLine && <p className="text-sm text-foreground">{addressLine}</p>}
          </div>
          {confirmation.venuePhone && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Questions?</p>
              <p className="text-sm text-heading">{confirmation.venuePhone}</p>
            </div>
          )}
        </div>

        <p className="text-sm text-foreground text-center">
          A confirmation email has been sent to {confirmation.email}.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={gcalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2.5 rounded-lg border transition-opacity hover:opacity-90 w-full sm:w-auto"
            style={{ borderColor: primary, color: readableInk(primary, "#ffffff") }}
          >
            Add to Google Calendar
          </a>
          <a
            href={icsUrl}
            download="tour.ics"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2.5 rounded-lg border border-border text-foreground bg-card transition-opacity hover:opacity-90 w-full sm:w-auto"
          >
            Download .ics
          </a>
        </div>
        <HtcPlatformMark className="pt-2" />
      </div>
    </div>
  );
}
