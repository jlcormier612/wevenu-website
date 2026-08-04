import Link from "next/link";

import { lookupActivationToken } from "@shared/relationships";

import { ActivateAccountForm } from "@/components/activate/activate-account-form";

export const metadata = { title: "Activate account" };

function ActivationErrorPanel({
  title,
  message,
  showLogin,
}: {
  title: string;
  message: string;
  showLogin?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--warm-gray)] px-6">
      <div className="ws-panel ws-enter w-full max-w-md p-8 md:p-10">
        <p className="ws-eyebrow">Hello to Cheers</p>
        <h1 className="mt-3 font-heading text-3xl tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed ws-muted" role="alert">
          {message}
        </p>
        {showLogin ? (
          <Link
            href={
              (
                process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() ||
                process.env.NEXT_PUBLIC_APP_URL?.trim() ||
                "http://localhost:3000"
              ).replace(/\/$/, "") + "/login"
            }
            className="mt-6 inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            Go to sign in →
          </Link>
        ) : (
          <p className="mt-6 text-sm ws-muted">
            Need help? Reply to your welcome email and Jennifer will send a fresh
            link.
          </p>
        )}
      </div>
    </div>
  );
}

export default async function ActivateAccountPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken || "").trim();
  const lookup = await lookupActivationToken(token);

  if (!lookup.ok) {
    const showLogin = lookup.reason === "already_activated";
    const title =
      lookup.reason === "expired"
        ? "Link expired"
        : lookup.reason === "already_activated"
          ? "Already activated"
          : lookup.reason === "access_disabled"
            ? "Account unavailable"
            : "Invalid link";
    return (
      <ActivationErrorPanel
        title={title}
        message={lookup.message}
        showLogin={showLogin}
      />
    );
  }

  const { relationship } = lookup;
  const email = relationship.owner.email?.trim() || "";
  const venueName = relationship.venue.name?.trim() || "your venue";

  if (!email) {
    return (
      <ActivationErrorPanel
        title="Missing email"
        message="This relationship has no owner email on file. Contact Hello to Cheers support."
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--warm-gray)] px-6">
      <div className="ws-panel ws-enter w-full max-w-md p-8 md:p-10">
        <p className="ws-eyebrow">Hello to Cheers</p>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Activate account
        </h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed ws-muted">
          Create a password for {venueName} to open Hello to Cheers.
        </p>
        <ActivateAccountForm
          token={token}
          email={email}
          venueName={venueName}
        />
      </div>
    </div>
  );
}
