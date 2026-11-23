import type { Metadata } from "next";
import Link from "next/link";

import { CustomOfferClient } from "./offer-client";

export const metadata: Metadata = {
  title: "Your private offer | Hello to Cheers",
  description: "Review your private Hello to Cheers subscription offer.",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ canceled?: string }>;
};

export default async function CustomOfferPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const sp = await searchParams;
  return (
    <main className="mx-auto min-h-[70vh] max-w-2xl px-6 py-12">
      <p className="font-[family-name:var(--font-script)] text-3xl text-[color:var(--color-forest,#1f3d2b)]">
        Hello to Cheers
      </p>
      <h1 className="mt-4 font-[family-name:var(--font-heading)] text-3xl font-medium tracking-tight text-[color:var(--color-ink,#1a1a1a)]">
        Your private offer
      </h1>
      <p className="mt-2 text-base text-[color:var(--color-muted,#5c5c5c)]">
        Review the terms below. Nothing is charged until you accept and complete
        secure checkout.
      </p>
      {sp.canceled === "1" ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Checkout was canceled. Your accepted terms are unchanged — you can try
          again when ready.
        </p>
      ) : null}
      <CustomOfferClient token={token} />
      <p className="mt-10 text-sm text-[color:var(--color-muted,#5c5c5c)]">
        Questions?{" "}
        <Link className="underline" href="/contact">
          Contact Hello to Cheers
        </Link>
        .
      </p>
    </main>
  );
}
