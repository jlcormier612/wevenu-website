"use client";

import * as React from "react";

import type { TourBookingConfirmation } from "@/lib/inquiry-form/types";

function formatReadableDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatReadableTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

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
  primaryColor,
}: {
  firstName: string;
  venueName: string;
  primaryColor: string;
}) {
  const heading = firstName.trim() ? `Thank you, ${firstName.trim()}!` : "Thank you!";
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `${primaryColor}10` }}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
        <p className="text-gray-600">We&apos;ve received your inquiry for {venueName}.</p>
        <p className="text-gray-600">We&apos;ll be in touch soon.</p>
      </div>
    </div>
  );
}

export function ScheduleTourConfirmation({
  firstName,
  confirmation,
  primaryColor,
}: {
  firstName: string;
  confirmation: TourBookingConfirmation;
  primaryColor: string;
}) {
  const heading = firstName.trim() ? `You're booked, ${firstName.trim()}!` : "You're booked!";
  const dateIso = confirmation.scheduledAt.slice(0, 10);
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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `${primaryColor}10` }}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
          <p className="text-gray-600">We&apos;re looking forward to meeting you at {confirmation.venueName}.</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-3 text-left">
          <p className="text-sm font-semibold text-gray-900">Your tour</p>
          <div>
            <p className="text-xs font-medium text-gray-500">Date</p>
            <p className="text-sm text-gray-900">{formatReadableDate(dateIso)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Time</p>
            <p className="text-sm text-gray-900">{formatReadableTime(confirmation.scheduledAt)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Location</p>
            <p className="text-sm text-gray-900">{confirmation.venueName}</p>
            {addressLine && <p className="text-sm text-gray-700">{addressLine}</p>}
          </div>
          {confirmation.venuePhone && (
            <div>
              <p className="text-xs font-medium text-gray-500">Questions?</p>
              <p className="text-sm text-gray-900">{confirmation.venuePhone}</p>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-600 text-center">
          A confirmation email has been sent to {confirmation.email}.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={gcalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2.5 rounded-lg border transition-opacity hover:opacity-90 w-full sm:w-auto"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            Add to Google Calendar
          </a>
          <a
            href={icsUrl}
            download="tour.ics"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2.5 rounded-lg border border-gray-300 text-gray-800 bg-white transition-opacity hover:opacity-90 w-full sm:w-auto"
          >
            Download .ics
          </a>
        </div>
      </div>
    </div>
  );
}
