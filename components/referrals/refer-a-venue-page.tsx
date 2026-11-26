"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gift, PartyPopper, Users } from "lucide-react";

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
  statusDescription?: string;
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
};

const EMPTY: FormState = {
  venueName: "",
  city: "",
  state: "",
  website: "",
  contactEmail: "",
  contactName: "",
  contactRole: "",
};

export function ReferAVenuePage() {
  const [enabled, setEnabled] = useState(true);
  const [referrals, setReferrals] = useState<CustomerReferral[]>([]);
  const [availableCreditCents, setAvailableCreditCents] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);

  async function refresh() {
    const res = await fetch("/api/referrals");
    const json = (await res.json()) as {
      ok?: boolean;
      enabled?: boolean;
      referrals?: CustomerReferral[];
      availableCreditCents?: number;
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      setLoadError(json.error || "Unable to load referrals.");
      return;
    }
    setEnabled(json.enabled !== false);
    setReferrals(json.referrals ?? []);
    setAvailableCreditCents(json.availableCreditCents ?? 0);
    if (json.enabled === false) {
      setLoadError(json.message || "Refer a Venue is not available yet.");
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
          title: "Cheers to your referral!",
          body: "Thank you for introducing us to another venue. We're excited to connect with them! You can follow your referral's progress from your Refer a Venue page.",
        },
      );
      setForm(EMPTY);
      setShowForm(false);
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
    opts?: { required?: boolean; placeholder?: string },
  ) {
    const err = errors[key];
    return (
      <div className="space-y-1.5">
        <Label htmlFor={key}>
          {label}
          {opts?.required ? " *" : ""}
        </Label>
        <Input
          id={key}
          value={form[key]}
          placeholder={opts?.placeholder}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
      </div>
    );
  }

  const rewardsEarned = referrals.filter(
    (r) =>
      r.status === "credit_earned" ||
      r.status === "credit_applied" ||
      (r.rewardAmountCents != null && r.rewardAmountCents > 0),
  ).length;

  function scrollToForm() {
    setShowForm(true);
    setConfirmation(null);
    requestAnimationFrame(() => {
      document.getElementById("refer-form")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  return (
    <div className="space-y-8">
      {/* 1. Referral hero */}
      <section
        className="rounded-[14px] bg-[#E8EEE3] px-6 py-8 text-center sm:px-10 sm:py-10"
        data-testid="refer-hero"
      >
        <div className="mx-auto flex max-w-[600px] flex-col items-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[color:color-mix(in_oklch,var(--htc-botanical)_16%,white)] text-[color:var(--htc-botanical)]">
            <Gift className="h-7 w-7" aria-hidden />
          </div>
          <h2 className="font-serif text-[28px] font-normal leading-tight text-[color:var(--htc-charcoal,#2c2c2c)] sm:text-[36px]">
            One referral. One FREE month.
          </h2>
          <p className="mt-3 text-[18px] font-medium text-[color:var(--htc-charcoal,#2c2c2c)]">
            Good things are even better when shared.
          </p>
          <p className="mt-4 text-[15px] leading-[1.6] text-[color:var(--htc-charcoal,#2c2c2c)] sm:text-[16px]">
            Know another venue that would love Hello to Cheers? Introduce us! When your referral
            becomes a qualifying customer, we&apos;ll reward you with a subscription credit equal to
            one month of your venue&apos;s subscription.
          </p>
          {!confirmation && enabled ? (
            <Button
              type="button"
              size="lg"
              className="mt-6 min-h-11 bg-[color:var(--htc-botanical)] px-8 text-white hover:bg-[color:color-mix(in_oklch,var(--htc-botanical)_88%,black)]"
              onClick={scrollToForm}
            >
              Refer a Venue
            </Button>
          ) : null}
          <p className="mt-4 text-[14px] font-medium text-[color:var(--htc-charcoal,#2c2c2c)] sm:text-[15px]">
            Keep sharing. Keep earning.
          </p>
        </div>
      </section>

      {/* 2. Three-step explanation */}
      <section className="space-y-6" data-testid="refer-steps">
        <h3 className="text-center font-serif text-[24px] font-normal text-[color:var(--htc-charcoal,#2c2c2c)] sm:text-[26px]">
          It&apos;s as easy as 1, 2, 3.
        </h3>
        <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF1E9] text-[color:var(--htc-botanical)]">
              <Users className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-[17px] font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]">
              Introduce us
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--htc-charcoal,#2c2c2c)] sm:text-[15px]">
              Tell us about a venue you think would love Hello to Cheers.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF1E9] text-[color:var(--htc-botanical)]">
              <PartyPopper className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-[17px] font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]">
              They join the celebration
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--htc-charcoal,#2c2c2c)] sm:text-[15px]">
              Your referred venue becomes a Hello to Cheers customer and completes its qualifying
              period.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF1E9] text-[color:var(--htc-botanical)]">
              <Gift className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-[17px] font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]">
              Enjoy your reward
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--htc-charcoal,#2c2c2c)] sm:text-[15px]">
              Receive a subscription credit equal to one month of your venue&apos;s subscription.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Eligibility + Help link */}
      <div className="space-y-3 border-t border-[color:var(--htc-border-warm,#e6e0d6)] pt-6 text-center">
        <p className="text-[14px] leading-relaxed text-[color:var(--htc-charcoal,#2c2c2c)] sm:text-[15px]">
          There&apos;s no limit to the number of qualifying venues you can refer. Program eligibility
          requirements apply.
        </p>
        <Link
          href="/help/refer-a-venue-one-referral-one-free-month"
          className="inline-flex text-[14px] font-medium text-[color:var(--htc-botanical)] underline-offset-4 hover:underline"
        >
          Learn more about referral rewards
        </Link>
      </div>

      {/* Confirmation */}
      {confirmation ? (
        <Card className="border-[color:color-mix(in_oklch,var(--htc-botanical)_22%,transparent)] bg-[#F4F8F3]">
          <CardHeader className="items-center space-y-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF1E9] text-[color:var(--htc-botanical)]">
              <PartyPopper className="h-7 w-7" aria-hidden />
            </div>
            <CardTitle className="font-serif text-2xl font-normal text-[color:var(--htc-charcoal,#2c2c2c)]">
              {confirmation.title}
            </CardTitle>
            <CardDescription className="max-w-lg text-base text-[color:var(--htc-charcoal,#2c2c2c)]">
              {confirmation.body}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmation(null);
                document.getElementById("your-referrals")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              View my referrals
            </Button>
            <Button type="button" onClick={scrollToForm}>
              Refer another venue
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* 4. Referral submission form */}
      {showForm && !confirmation ? (
        <Card id="refer-form" className="scroll-mt-20 rounded-[12px] border border-border bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[color:var(--htc-charcoal,#2c2c2c)]">
              Introduce us to a venue
            </CardTitle>
            <CardDescription>
              Know a venue that would love Hello to Cheers? Tell us a little about them, and
              we&apos;ll take it from here.
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
                  {field("venueName", "Venue name", {
                    required: true,
                    placeholder: "The name of the venue",
                  })}
                  {field("website", "Venue website", {
                    required: true,
                    placeholder: "https://",
                  })}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("city", "City", { required: true, placeholder: "City" })}
                  {field("state", "State", { required: true, placeholder: "State" })}
                </div>

                <div className="space-y-1 pt-2">
                  <p className="text-sm font-medium text-heading">Who should we connect with?</p>
                  <p className="text-xs text-muted-foreground">
                    Ideally, someone involved in managing the venue or making business decisions.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("contactName", "Contact name", {
                    required: true,
                    placeholder: "First and last name",
                  })}
                  {field("contactRole", "Role / Title (optional)", {
                    placeholder: "Owner, General Manager, Venue Director...",
                  })}
                </div>
                <div className="space-y-1.5">
                  {field("contactEmail", "Business contact email", {
                    required: true,
                    placeholder: "Their business email address",
                  })}
                  <p className="text-xs text-muted-foreground">
                    Please provide a direct business contact email so we can reach the right person.
                  </p>
                </div>
                {message ? <p className="text-sm text-destructive">{message}</p> : null}
                <Button type="submit" disabled={busy} size="lg">
                  {busy ? "Sending…" : "Submit referral"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* 5. Tracking */}
      <Card id="your-referrals" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Your referrals</CardTitle>
          <CardDescription>
            Visit your Refer a Venue page at any time to review your submitted referrals and their
            progress.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-[color:var(--htc-canvas,#f7f4ef)] p-3">
              <p className="text-xs text-muted-foreground">Venues referred</p>
              <p className="text-lg font-medium text-foreground">{referrals.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-[color:var(--htc-canvas,#f7f4ef)] p-3">
              <p className="text-xs text-muted-foreground">Rewards earned</p>
              <p className="text-lg font-medium text-foreground">{rewardsEarned}</p>
            </div>
            <div className="rounded-lg border border-border bg-[#EEF1E9] p-3">
              <p className="text-xs text-muted-foreground">Available credit</p>
              <p className="text-lg font-medium text-foreground">
                {formatUsdFromCents(availableCreditCents)}
              </p>
            </div>
          </div>

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
                </div>
                <div className="text-sm sm:text-right">
                  <p className="font-medium text-foreground">{row.statusLabel}</p>
                  <p className="text-muted-foreground">
                    {row.statusDescription ??
                      (row.rewardAmountCents != null
                        ? `${formatUsdFromCents(row.rewardAmountCents)} subscription credit${row.appliedInvoiceId ? " applied to your subscription." : " available."}`
                        : null)}
                  </p>
                </div>
              </div>
            ))
          )}

          <Link
            href="/settings/billing"
            className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View subscription credits
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
