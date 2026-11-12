"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

type CustomerReferral = {
  id: string;
  referredVenueName: string;
  referredCity: string;
  referredState: string;
  submittedAt: string;
  status: string;
  statusLabel: string;
  rewardAmountCents: number | null;
  rewardCurrency: string | null;
  appliedInvoiceId: string | null;
};

type FormState = {
  venueName: string;
  city: string;
  state: string;
  website: string;
  contactEmail: string;
  contactName: string;
  contactRole: string;
  notes: string;
};

const EMPTY: FormState = {
  venueName: "",
  city: "",
  state: "",
  website: "",
  contactEmail: "",
  contactName: "",
  contactRole: "",
  notes: "",
};

export function ReferAVenuePage() {
  const [enabled, setEnabled] = useState(true);
  const [referrals, setReferrals] = useState<CustomerReferral[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/referrals");
    const json = (await res.json()) as {
      ok?: boolean;
      enabled?: boolean;
      referrals?: CustomerReferral[];
      error?: string;
      readiness?: { diagnosticMessage?: string };
    };
    if (!res.ok) {
      setLoadError(json.error || "Unable to load referrals.");
      return;
    }
    setEnabled(json.enabled !== false);
    setReferrals(json.referrals ?? []);
    if (json.enabled === false) {
      setLoadError(
        json.readiness?.diagnosticMessage ||
          "Refer a Venue is not available yet.",
      );
    } else {
      setLoadError(null);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setErrors({});
    setConfirmation(null);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        errors?: Record<string, string>;
        confirmation?: { title: string; body: string };
        referral?: CustomerReferral;
      };
      if (!res.ok || !json.ok) {
        setErrors(json.errors ?? {});
        setMessage(json.message || "Could not submit referral.");
        return;
      }
      setConfirmation(
        json.confirmation ?? {
          title: "Thanks for sharing the Luv!",
          body: "We've received your referral, and we'll take it from here. We appreciate you helping more venues discover Hello to Cheers!",
        },
      );
      setForm(EMPTY);
      await refresh();
    } catch {
      setMessage("Could not submit referral. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function field(
    key: keyof FormState,
    label: string,
    opts?: { required?: boolean; textarea?: boolean; placeholder?: string },
  ) {
    const err = errors[key];
    return (
      <div className="space-y-1.5">
        <Label htmlFor={key}>
          {label}
          {opts?.required ? " *" : ""}
        </Label>
        {opts?.textarea ? (
          <Textarea
            id={key}
            value={form[key]}
            placeholder={opts.placeholder}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        ) : (
          <Input
            id={key}
            value={form[key]}
            placeholder={opts?.placeholder}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        )}
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium tracking-[0.14em] text-[color:var(--heritage-sage)] uppercase">
          A little thank-you for spreading the word
        </p>
        <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">
          Share the Luv. Get a free month.
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Know another venue that could use a little more ease and a lot less busywork?
          We&apos;d love an introduction!
        </p>
      </div>

      <Card className="border-[color:var(--soft-sage)] bg-[color:color-mix(in_oklch,var(--soft-sage)_28%,white)]">
        <CardHeader className="space-y-2">
          <CardTitle className="font-serif text-2xl text-heading">
            One referral. One FREE month.
          </CardTitle>
          <CardDescription className="text-base text-foreground/80">
            When a venue you refer becomes a paying Hello to Cheers customer, we&apos;ll thank
            you with a free month of your own subscription.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground/80">
          <p className="font-medium text-heading">And yes, you can earn more than one!</p>
          <p>
            Every new qualifying venue you refer brings another free month your way.
          </p>
          <p>
            Qualifying referrals are new, independently paying venues. Your thank-you is a
            one-time credit equal to one month of your applicable subscription after the
            referred venue has remained paying for 30 days with settled payment. Self-referrals,
            duplicates, and refunded or disputed purchases do not qualify. Complete program
            details follow the Refer a Venue policy applied at reward time.
          </p>
        </CardContent>
      </Card>

      {confirmation ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{confirmation.title}</CardTitle>
            <CardDescription>{confirmation.body}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Refer a Venue</CardTitle>
          <CardDescription className="space-y-2 text-base text-muted-foreground">
            <span className="block font-medium text-foreground">
              Know a venue that would love Hello to Cheers?
            </span>
            <span className="block">
              Share a few details about them, and we&apos;ll take it from there! We&apos;ll
              personally review your referral and reach out with a thoughtful introduction.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!enabled ? (
            <p className="text-sm text-muted-foreground">
              {loadError || "Referrals are temporarily unavailable."}
            </p>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("venueName", "Venue name", { required: true })}
                {field("website", "Venue website", {
                  required: true,
                  placeholder: "https://",
                })}
                {field("city", "City", { required: true })}
                {field("state", "State", { required: true })}
                {field("contactName", "Contact name", { required: true })}
                {field("contactEmail", "Business contact email", {
                  required: true,
                })}
                {field("contactRole", "Contact role / title")}
              </div>
              {field("notes", "Notes", { textarea: true })}
              {message ? (
                <p className="text-sm text-destructive">{message}</p>
              ) : null}
              <Button type="submit" disabled={busy} size="lg">
                {busy ? "Sending…" : "Share the Luv"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your referrals</CardTitle>
          <CardDescription>
            Track submissions and thank-you credits for this venue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No referrals yet — when you share one, it will show up here.
            </p>
          ) : (
            referrals.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-medium">{row.referredVenueName}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.referredCity}, {row.referredState}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted{" "}
                    {new Date(row.submittedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-sm sm:text-right">
                  <p>{row.statusLabel}</p>
                  {row.rewardAmountCents != null ? (
                    <p className="text-muted-foreground">
                      {formatUsdFromCents(row.rewardAmountCents)} thank-you
                      credit
                      {row.appliedInvoiceId
                        ? ` · applied on ${row.appliedInvoiceId}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
