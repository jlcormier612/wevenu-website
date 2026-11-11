"use client";

/**
 * Optional venue-level representation — not authenticated person identity,
 * not Owner membership, and not per-user signature.
 */
import * as React from "react";
import Link from "next/link";

import { saveVenueRepresentationAction } from "@/app/(app)/settings/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeVenuePhoneInput } from "@/lib/sms/phone";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function VenueRepresentationSection({
  initialEmail,
  initialPhone,
}: {
  initialEmail: string;
  initialPhone: string;
}) {
  const [email, setEmail] = React.useState(initialEmail);
  const [phone, setPhone] = React.useState(() => normalizeVenuePhoneInput(initialPhone));
  const [open, setOpen] = React.useState(Boolean(initialEmail || initialPhone));
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const normalizedPhone = normalizeVenuePhoneInput(phone);
    setPhone(normalizedPhone);
    const result = await saveVenueRepresentationAction({ email, phone: normalizedPhone });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Could not save.");
      return;
    }
    setMessage("Saved.");
  }

  return (
    <Card data-venue-representation>
      <CardHeader>
        <CardTitle className="text-base">How your venue is represented</CardTitle>
        <CardDescription>
          Optional venue-level contact details for couples and public communications.
          They are separate from who is logged in, who owns the venue, and each person&apos;s
          email signature.{" "}
          <Link href="/settings/business" className="font-medium text-primary hover:underline">
            Owners and full venue details
          </Link>{" "}
          live in Business &amp; Brand.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!open ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            data-venue-representation-open
          >
            Add optional venue contact details
          </Button>
        ) : (
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="venue-contact-email">Venue contact email</Label>
              <Input
                id="venue-contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@yourvenue.com"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Used when Hello to Cheers needs a venue address for couple-facing and
                venue communications. Leave blank to keep the current default.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-phone">Venue phone</Label>
              <Input
                id="venue-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhone(normalizeVenuePhoneInput(phone))}
                placeholder="(555) 123-4567"
                autoComplete="off"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
              {!initialEmail && !initialPhone ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Not now
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
