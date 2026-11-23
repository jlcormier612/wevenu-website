"use client";

import { useEffect, useState } from "react";

type Preview = {
  planDisplayName: string;
  listAmountCents: number;
  monthlyRecurringCents: number;
  monthlySavingsCents: number;
  whiteGloveAmountCents: number;
  whiteGloveLabel: string;
  initialPaymentCents: number;
  futureMonthlyCents: number;
  afterIntroLabel: string;
  durationLabel: string;
  tierUpgradeLabel: string;
  expiresAt: string | null;
  promoNote: string;
  lines: string[];
};

type OfferView = {
  status: string;
  venueName: string;
  recipientName: string | null;
  recipientEmail: string | null;
  customerMessage: string | null;
  expiresAt: string | null;
  preview: Preview | null;
};

function usd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function CustomOfferClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<OfferView | null>(null);
  const [canAccept, setCanAccept] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/custom-offer/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Offer not found.");
          setLoading(false);
          return;
        }
        setOffer(data.offer);
        setCanAccept(Boolean(data.canAccept));
        setBlocked(data.acceptBlocked?.message || null);
        if (
          data.offer?.status === "accepted" ||
          data.offer?.status === "checkout_pending" ||
          data.offer?.status === "paid"
        ) {
          setAccepted(true);
        }
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Could not load this offer.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function acceptAndCheckout() {
    setBusy(true);
    setMessage(null);
    try {
      if (!accepted) {
        const acceptRes = await fetch(
          `/api/custom-offer/${encodeURIComponent(token)}/accept`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accept: true }),
          },
        );
        const acceptData = await acceptRes.json();
        if (!acceptRes.ok) {
          setMessage(acceptData.error || "Could not accept offer.");
          setBusy(false);
          return;
        }
        setAccepted(true);
      }

      const checkoutRes = await fetch(
        `/api/custom-offer/${encodeURIComponent(token)}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accept: true }),
        },
      );
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutData.url) {
        setMessage(checkoutData.error || "Could not start checkout.");
        setBusy(false);
        return;
      }
      window.location.href = checkoutData.url;
    } catch {
      setMessage("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="mt-8 text-sm text-[color:var(--color-muted,#5c5c5c)]">Loading offer…</p>;
  }
  if (error) {
    return (
      <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-950">
        <p>{error}</p>
        <p className="mt-2">
          If you believe this is a mistake, contact Hello to Cheers and we will
          help.
        </p>
      </div>
    );
  }
  if (!offer?.preview) {
    return (
      <p className="mt-8 text-sm text-[color:var(--color-muted,#5c5c5c)]">
        This offer is unavailable.
      </p>
    );
  }

  const p = offer.preview;
  const terminal =
    offer.status === "expired" ||
    offer.status === "revoked" ||
    offer.status === "superseded" ||
    offer.status === "paid";

  return (
    <div className="mt-8 space-y-6" data-testid="custom-offer-page">
      <div className="rounded-xl border border-[color:rgba(31,61,43,0.15)] bg-[color:#faf8f4] p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--color-muted,#5c5c5c)]">
          Prepared for {offer.venueName}
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl text-[color:var(--color-forest,#1f3d2b)]">
          {p.planDisplayName}
        </h2>
        <p className="mt-3 text-3xl font-medium text-[color:var(--color-forest,#1f3d2b)]">
          {usd(p.monthlyRecurringCents)}
          <span className="text-base font-normal text-[color:var(--color-muted,#5c5c5c)]">
            /month
          </span>
        </p>
        <p className="mt-1 text-sm text-[color:var(--color-muted,#5c5c5c)]">
          Regularly {usd(p.listAmountCents)}/month
          {p.monthlySavingsCents > 0
            ? ` — save ${usd(p.monthlySavingsCents)}/month`
            : ""}
        </p>
        <ul className="mt-5 space-y-2 text-sm leading-relaxed text-[color:var(--color-ink,#1a1a1a)]">
          <li>{p.durationLabel}.</li>
          <li>{p.afterIntroLabel}</li>
          <li>{p.tierUpgradeLabel}</li>
          <li>
            White Glove: {p.whiteGloveLabel}
            {p.whiteGloveAmountCents > 0
              ? ` (${usd(p.whiteGloveAmountCents)} one-time)`
              : ""}
          </li>
          <li>
            Estimated initial payment (before applicable taxes):{" "}
            {usd(p.initialPaymentCents)}
          </li>
          <li>Then {usd(p.futureMonthlyCents)}/month during special pricing.</li>
          {p.expiresAt ? (
            <li>Offer expires: {new Date(p.expiresAt).toLocaleString()}</li>
          ) : null}
        </ul>
        <p className="mt-4 text-xs text-[color:var(--color-muted,#5c5c5c)]">
          {p.promoNote} Applicable taxes may be added at checkout.
        </p>
        {offer.customerMessage ? (
          <div className="mt-5 rounded-md border border-[color:rgba(31,61,43,0.12)] bg-white p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-[color:var(--color-muted,#5c5c5c)]">
              A note from Hello to Cheers
            </p>
            <p className="mt-2 whitespace-pre-wrap">{offer.customerMessage}</p>
          </div>
        ) : null}
      </div>

      {blocked || terminal ? (
        <div className="rounded-md border border-[color:rgba(31,61,43,0.15)] bg-white p-4 text-sm">
          <p>
            {blocked ||
              (offer.status === "paid"
                ? "This offer has already been completed. Thank you!"
                : "This offer is no longer available for acceptance.")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              data-testid="accept-offer-terms"
            />
            <span>
              I accept these offer terms for {offer.venueName}, including the
              monthly subscription price, White Glove fee (if any), duration, and
              future billing terms described above.
            </span>
          </label>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-[color:var(--color-forest,#1f3d2b)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={busy || !accepted || !canAccept}
            onClick={() => void acceptAndCheckout()}
            data-testid="accept-and-checkout"
          >
            {busy ? "Starting checkout…" : "Accept & continue to checkout"}
          </button>
          {message ? (
            <p className="text-sm text-red-700" role="alert">
              {message}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
