"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Gift } from "lucide-react";

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

  const rewardsEarned = referrals.filter((r) =>
    r.status === "credit_earned" || r.status === "credit_applied" || (r.rewardAmountCents != null && r.rewardAmountCents > 0),
  ).length;

  return (
    <div className="space-y-6">
      <Card className="border-[color:var(--soft-sage)] bg-[color:color-mix(in_oklch,var(--linen)_70%,white)]">
        <CardHeader className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:color-mix(in_oklch,var(--heritage-sage)_18%,white)] text-[color:var(--heritage-sage)]">
            <Gift className="h-5 w-5" aria-hidden />
          </div>
          <CardTitle className="font-serif text-2xl text-heading">
            One referral. One FREE month.
          </CardTitle>
          <CardDescription className="text-base text-foreground/80">
            Good things are even better when shared.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-foreground/80">
          <p>
            Know another venue that would love Hello to Cheers? Introduce us! When your referral becomes a qualifying customer, we&apos;ll reward you with a subscription credit equal to one month of your venue&apos;s subscription.
          </p>
          <div className="space-y-2">
            <p className="font-medium text-heading">It&apos;s as easy as 1, 2, 3.</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <span className="font-medium text-foreground">Introduce us</span>
                {" — "}
                Tell us about a venue you think would love Hello to Cheers.
              </li>
              <li>
                <span className="font-medium text-foreground">They join the celebration</span>
                {" — "}
                Your referred venue becomes a Hello to Cheers customer and completes its qualifying period.
              </li>
              <li>
                <span className="font-medium text-foreground">Enjoy your reward</span>
                {" — "}
                Receive a subscription credit equal to one month of your venue&apos;s subscription.
              </li>
            </ol>
          </div>
          <p>
            There&apos;s no limit to the number of qualifying venues you can refer. Program eligibility requirements apply.
          </p>
          <p className="font-medium text-heading">Keep sharing. Keep earning.</p>
          {!confirmation && enabled ? (
            <Button
              type="button"
              size="lg"
              className="bg-[color:var(--heritage-sage)] text-white hover:bg-[color:color-mix(in_oklch,var(--heritage-sage)_88%,black)]"
              onClick={() => {
                setShowForm(true);
                document.getElementById("refer-form")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Refer a Venue
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {confirmation ? (
        <Card>
          <CardHeader className="items-center text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-[color:var(--heritage-sage)]" aria-hidden />
            <CardTitle className="text-xl">{confirmation.title}</CardTitle>
            <CardDescription className="text-base">{confirmation.body}</CardDescription>
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
            <Button
              type="button"
              onClick={() => {
                setConfirmation(null);
                setShowForm(true);
              }}
            >
              Refer another venue
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showForm && !confirmation ? (
        <Card id="refer-form" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="text-base">Introduce us to a venue</CardTitle>
            <CardDescription>
              Know a venue that would love Hello to Cheers? Tell us a little about them, and we&apos;ll take it from here.
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
                  {field("contactEmail", "Business contact email", {
                    required: true,
                    placeholder: "Their business email address",
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Please provide a direct business contact email so we can reach the right person.
                </p>
                {message ? (
                  <p className="text-sm text-destructive">{message}</p>
                ) : null}
                <Button type="submit" disabled={busy} size="lg">
                  {busy ? "Sending…" : "Submit referral"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card data-testid="refer-program-details">
        <CardHeader>
          <CardTitle className="text-base">Learn more about referral rewards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            For every qualifying venue you introduce to Hello to Cheers, you&apos;ll receive a subscription credit equal to one month of your venue&apos;s subscription.
          </p>
          <p>
            When your referred venue becomes a new paying Hello to Cheers customer and completes 30 days as a qualifying paying subscriber, your referral becomes eligible for a reward. Once approved, your credit will be applied toward your next eligible subscription invoice.
          </p>
          <div className="space-y-1">
            <p className="font-medium text-foreground">A few things to know</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Referrals must represent genuine introductions to new, independently paying venues.</li>
              <li>Each qualifying venue can generate one referral reward.</li>
              <li>Self-referrals and duplicate rewards are not eligible.</li>
              <li>Referred venues must complete the required qualifying period with eligible, settled subscription payments.</li>
              <li>Refunded or disputed payments may affect referral eligibility.</li>
              <li>Rewards are issued as subscription credits rather than cash payments.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card id="your-referrals" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Your referrals</CardTitle>
          <CardDescription>
            Visit your Refer a Venue page at any time to review your submitted referrals and their progress.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Venues referred</p>
              <p className="text-lg font-medium text-foreground">{referrals.length}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Rewards earned</p>
              <p className="text-lg font-medium text-foreground">{rewardsEarned}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
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
                    {row.statusDescription
                      ?? (row.rewardAmountCents != null
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
