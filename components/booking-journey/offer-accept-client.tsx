"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { acceptOfferAction } from "@/app/offer/actions";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/invoices/constants";

export function OfferAcceptClient({
  token,
  offer,
}: {
  token: string;
  offer: {
    name: string;
    totalAmount: number;
    depositAmount: number;
    remainingAmount: number;
    includedItems: { description: string; quantity: number; unit: string | null }[];
    status: string;
    offerMessage: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const accepted = offer.status === "accepted";

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptOfferAction(token);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Thank you — your package is accepted.");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your offer</p>
      <h1 className="mt-2 font-heading text-3xl text-heading">{offer.name}</h1>
      <p className="mt-2 text-2xl font-semibold text-heading">{formatCurrency(offer.totalAmount)}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Deposit {formatCurrency(offer.depositAmount)} · Remaining {formatCurrency(offer.remainingAmount)}
      </p>
      {offer.offerMessage && (
        <p className="mt-6 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-heading whitespace-pre-wrap">
          {offer.offerMessage}
        </p>
      )}
      {offer.includedItems.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-heading">What&apos;s included</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {offer.includedItems.map((item, i) => (
              <li key={`${item.description}-${i}`}>
                • {item.description}
                {item.quantity ? ` × ${item.quantity}` : ""}
                {item.unit ? ` ${item.unit}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8">
        {accepted ? (
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-heading">
            You&apos;ve accepted this package. Your venue will collect the deposit next.
          </p>
        ) : (
          <Button type="button" size="lg" className="w-full" onClick={handleAccept} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting…
              </>
            ) : (
              "Accept"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
