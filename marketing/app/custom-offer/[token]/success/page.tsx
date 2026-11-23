import Link from "next/link";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CustomOfferSuccessPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const sp = await searchParams;
  return (
    <main className="mx-auto min-h-[60vh] max-w-xl px-6 py-16 text-center">
      <p className="font-[family-name:var(--font-script)] text-3xl text-[color:var(--color-forest,#1f3d2b)]">
        Hello to Cheers
      </p>
      <h1 className="mt-4 font-[family-name:var(--font-heading)] text-3xl">
        Thank you
      </h1>
      <p className="mt-3 text-[color:var(--color-muted,#5c5c5c)]">
        Your payment is processing. Activation completes when Stripe confirms
        payment — you will receive a confirmation email shortly.
      </p>
      {sp.session_id ? (
        <p className="mt-4 text-xs text-[color:var(--color-muted,#5c5c5c)]">
          Reference: {sp.session_id}
        </p>
      ) : null}
      <p className="mt-8 text-sm">
        <Link className="underline" href={`/custom-offer/${token}`}>
          Return to offer
        </Link>
        {" · "}
        <Link className="underline" href="/contact">
          Contact us
        </Link>
      </p>
    </main>
  );
}
